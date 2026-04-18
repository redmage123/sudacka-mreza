#!/usr/bin/env python3
"""
Legal NLP Service for Sudačka Mreža
====================================
FastAPI service providing:
1. Named Entity Recognition (NER) — parties, judges, laws, amounts, dates
2. Summarization — plain-language summary via Claude Haiku
3. Case similarity — semantic search via RAG embeddings
4. Topic classification — auto-classify by legal area
5. Outcome analysis — plaintiff win/loss, appeal upheld/overturned
6. Translation — Croatian→target language via OPUS-MT

Runs on CPU. Models loaded lazily on first use.
"""

import json
import logging
import os
import re
import subprocess
import time
from functools import lru_cache
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("legal-nlp")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

app = FastAPI(title="Sudačka Mreža Legal NLP", version="1.0.0")

DB_CMD = ["docker", "exec", "sudacka-mreza-db-1", "psql", "-U", "postgres", "-d", "sudacka_mreza", "-t", "-A", "-c"]
RAG_URL = "http://localhost:8020/api/v1"
RAG_KEY = "rag_ak_aielevate_2026_secret"

# ============================================================================
# Lazy model loading
# ============================================================================

_models = {}

def get_sentence_model():
    if "sentence" not in _models:
        logger.info("Loading sentence-transformers model...")
        from sentence_transformers import SentenceTransformer
        _models["sentence"] = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Sentence model loaded")
    return _models["sentence"]

def get_translation_model(src="hr", tgt="en"):
    key = f"opus-{src}-{tgt}"
    if key not in _models:
        logger.info(f"Loading OPUS-MT {src}→{tgt}...")
        from transformers import MarianMTModel, MarianTokenizer
        model_name = f"Helsinki-NLP/opus-mt-{src}-{tgt}"
        try:
            _models[key] = {
                "tokenizer": MarianTokenizer.from_pretrained(model_name),
                "model": MarianMTModel.from_pretrained(model_name),
            }
            logger.info(f"OPUS-MT {src}→{tgt} loaded")
        except Exception as e:
            logger.warning(f"OPUS-MT {src}→{tgt} not available: {e}")
            return None
    return _models.get(key)

def get_classifier():
    """Simple keyword-based legal topic classifier (no ML model needed)."""
    return {
        "property": ["vlasništvo", "nekretnin", "zakup", "najam", "etažn", "posjet", "građevinsk"],
        "employment": ["radni odnos", "otkaz", "plaća", "zapošljav", "radnik", "poslodav", "kolektivn"],
        "family": ["bračn", "razvod", "uzdržavan", "skrbništ", "dijete", "roditeljsk", "obitelj"],
        "criminal": ["kazneno", "optužen", "presud", "kazn", "zatvor", "okrivljen", "krivnj"],
        "commercial": ["trgovačk", "stečaj", "likvidacij", "društvo", "dioničar", "d.o.o", "d.d."],
        "administrative": ["upravni", "rješenj", "dozvol", "porezn", "inspekcij", "koncesij"],
        "debt": ["ovrh", "tražbin", "dug", "pristojb", "naplat", "javnobilježnički"],
        "damages": ["naknada štete", "odšteta", "odgovornost", "osiguran"],
    }

# ============================================================================
# 1. Named Entity Recognition
# ============================================================================

class NERRequest(BaseModel):
    text: str
    max_length: int = 10000

class NERResponse(BaseModel):
    entities: dict

@app.post("/api/nlp/ner", response_model=NERResponse)
def extract_entities(req: NERRequest):
    text = req.text[:req.max_length]
    
    entities = {
        "courts": [],
        "judges": [],
        "parties": [],
        "laws": [],
        "articles": [],
        "amounts": [],
        "dates": [],
        "case_numbers": [],
    }
    
    # Case numbers: Gž-123/2024-2, Pž-456/2023, Rev-789/2022
    for m in re.finditer(r'\b([A-Za-zŽžČčĆćŠšĐđ]{1,5}-\d{1,6}/\d{4}(?:-\d{1,3})?)\b', text):
        if m.group(1) not in entities["case_numbers"]:
            entities["case_numbers"].append(m.group(1))
    
    # Law references: Zakon o ..., Zakona o ...
    for m in re.finditer(r'(Zakon[a-u]?\s+o\s+[A-Za-zŽžČčĆćŠšĐđ\s,]+?)(?:\s*\(|\s*čl\.|\s*člank)', text):
        law = m.group(1).strip().rstrip(',')
        if law not in entities["laws"] and len(law) > 10:
            entities["laws"].append(law)
    
    # Article references: čl. 123., članak 45., čl. 12. st. 3.
    for m in re.finditer(r'(?:čl(?:anak|\.)\s*(\d+\.?)(?:\s*st(?:avak|\.)\s*(\d+\.?))?)', text):
        art = f"čl. {m.group(1)}"
        if m.group(2):
            art += f" st. {m.group(2)}"
        if art not in entities["articles"]:
            entities["articles"].append(art)
    
    # Monetary amounts: 1.234,56 kn/EUR/HRK
    for m in re.finditer(r'([\d.,]+)\s*(?:kn|kuna|EUR|HRK|€)', text):
        amt = m.group(0).strip()
        if amt not in entities["amounts"]:
            entities["amounts"].append(amt)
    
    # Dates: DD.MM.YYYY or DD. mjeseca YYYY.
    for m in re.finditer(r'\b(\d{1,2}\.\s*(?:\d{1,2}\.\s*\d{4}|\w+\s+\d{4})\.?)\b', text):
        d = m.group(1).strip()
        if d not in entities["dates"] and len(d) > 5:
            entities["dates"].append(d)
    
    # Court names: ... sud u/u ...
    for m in re.finditer(r'((?:Općinski|Županijski|Trgovački|Vrhovni|Visoki|Upravni|Prekršajni)\s+(?:građanski\s+|kazneni\s+)?sud\s+(?:u\s+|Republike\s+)[A-Za-zŽžČčĆćŠšĐđ\s]+?)(?:\s*[,;.]|\s+\d|\s+na\s)', text):
        court = m.group(1).strip()
        if court not in entities["courts"]:
            entities["courts"].append(court)
    
    # Judge names: sudac/sutkinja Ime Prezime, predsjednik/ica suda Ime Prezime
    for m in re.finditer(r'(?:suda?c|sutkinja|predsjedni[ck])\w*\s+([A-ZŽČĆŠĐ][a-zžčćšđ]+\s+[A-ZŽČĆŠĐ][a-zžčćšđ]+)', text):
        name = m.group(1).strip()
        if name not in entities["judges"]:
            entities["judges"].append(name)
    
    # Party patterns: tužitelj/tuženik + name
    for role in ["tužitelj", "tuženik", "protutužitelj", "protutuženik", "predlagatelj", "protivnik predlaganja"]:
        for m in re.finditer(rf'{role}\w*\s+([A-ZŽČĆŠĐ][A-Za-zŽžČčĆćŠšĐđ\s.]+?)(?:\s*[,;]|\s+iz\s|\s+OIB)', text):
            party = m.group(1).strip()
            if party not in entities["parties"] and len(party) > 3:
                entities["parties"].append({"role": role, "name": party})
    
    return NERResponse(entities=entities)


# ============================================================================
# 2. Summarization (via Claude Haiku through proxy)
# ============================================================================

class SummarizeRequest(BaseModel):
    text: str
    language: str = "hr"
    max_input: int = 8000

class SummarizeResponse(BaseModel):
    summary: str
    language: str

@app.post("/api/nlp/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest):
    text = req.text[:req.max_input]
    lang_name = {"hr": "Croatian", "en": "English", "de": "German", "fr": "French",
                 "es": "Spanish", "it": "Italian"}.get(req.language, req.language)
    
    prompt = f"""Summarize this Croatian court decision in plain language in {lang_name}. 
Write 3-4 sentences: what the case was about, what was decided, and the key reasoning.
Do not use legal jargon. Write for a layperson.

Decision text:
{text}"""
    
    try:
        result = subprocess.run(
            ["curl", "-s", "http://127.0.0.1:3456/v1/chat/completions",
             "-H", "Content-Type: application/json",
             "-H", f"Authorization: Bearer dummy",
             "-d", json.dumps({
                 "model": "claude-haiku-4-5",
                 "messages": [{"role": "user", "content": prompt}],
                 "max_tokens": 500,
             })],
            capture_output=True, text=True, timeout=30
        )
        data = json.loads(result.stdout)
        summary = data["choices"][0]["message"]["content"]
        return SummarizeResponse(summary=summary, language=req.language)
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(500, "Summarization service unavailable")


# ============================================================================
# 3. Case Similarity
# ============================================================================

class SimilarityRequest(BaseModel):
    text: str
    top_k: int = 5

class SimilarityResponse(BaseModel):
    similar: list

@app.post("/api/nlp/similar", response_model=SimilarityResponse)
def find_similar(req: SimilarityRequest):
    model = get_sentence_model()
    query_embedding = model.encode(req.text[:2000]).tolist()
    
    # Use RAG API for vector search
    try:
        import urllib.request
        payload = json.dumps({
            "org_slug": "gigforge",
            "collection_slug": "sudacka-caselaw",
            "query": req.text[:500],
            "top_k": req.top_k,
        }).encode()
        r = urllib.request.Request(f"{RAG_URL}/query", data=payload,
                                   headers={"Authorization": f"Bearer {RAG_KEY}",
                                           "Content-Type": "application/json"})
        with urllib.request.urlopen(r, timeout=10) as resp:
            data = json.loads(resp.read())
        return SimilarityResponse(similar=data.get("results", []))
    except Exception as e:
        logger.warning(f"RAG similarity search failed: {e}")
        return SimilarityResponse(similar=[])


# ============================================================================
# 4. Topic Classification
# ============================================================================

class ClassifyRequest(BaseModel):
    text: str

class ClassifyResponse(BaseModel):
    topics: list
    primary_topic: str

@app.post("/api/nlp/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    text = req.text[:5000].lower()
    classifier = get_classifier()
    
    scores = {}
    for topic, keywords in classifier.items():
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > 0:
            scores[topic] = score
    
    sorted_topics = sorted(scores.items(), key=lambda x: -x[1])
    topics = [{"topic": t, "score": s} for t, s in sorted_topics]
    primary = sorted_topics[0][0] if sorted_topics else "general"
    
    return ClassifyResponse(topics=topics, primary_topic=primary)


# ============================================================================
# 5. Outcome Analysis
# ============================================================================

class OutcomeRequest(BaseModel):
    text: str

class OutcomeResponse(BaseModel):
    outcome: str
    confidence: float
    details: dict

@app.post("/api/nlp/outcome", response_model=OutcomeResponse)
def analyze_outcome(req: OutcomeRequest):
    text = req.text[:10000].lower()
    
    # Pattern matching for Croatian legal outcomes
    plaintiff_win = ["usvaja se", "udovoljava se", "prihvaća se tužbeni zahtjev", "nalaže se tuženiku"]
    plaintiff_loss = ["odbija se", "odbacuje se", "ne udovoljava se", "tužba se odbija", "tužbeni zahtjev se odbija"]
    appeal_upheld = ["žalba se usvaja", "preinačuje se", "ukida se prvostupanjska"]
    appeal_dismissed = ["žalba se odbija", "žalba.*neosnovana", "potvrđuje se prvostupanjska"]
    settled = ["nagodba", "povlači se tužba", "obustava postupka"]
    
    outcome = "unknown"
    confidence = 0.0
    details = {"signals": []}
    
    for pattern in plaintiff_win:
        if re.search(pattern, text):
            outcome = "plaintiff_win"
            confidence = 0.8
            details["signals"].append(pattern)
    
    for pattern in plaintiff_loss:
        if re.search(pattern, text):
            outcome = "plaintiff_loss" if outcome == "unknown" else outcome
            confidence = max(confidence, 0.8)
            details["signals"].append(pattern)
    
    for pattern in appeal_upheld:
        if re.search(pattern, text):
            outcome = "appeal_upheld"
            confidence = 0.85
            details["signals"].append(pattern)
    
    for pattern in appeal_dismissed:
        if re.search(pattern, text):
            outcome = "appeal_dismissed"
            confidence = 0.85
            details["signals"].append(pattern)
    
    for pattern in settled:
        if re.search(pattern, text):
            outcome = "settled"
            confidence = 0.7
            details["signals"].append(pattern)
    
    return OutcomeResponse(outcome=outcome, confidence=confidence, details=details)


# ============================================================================
# 6. Translation (OPUS-MT)
# ============================================================================

class TranslateRequest(BaseModel):
    text: str
    source: str = "hr"
    target: str = "en"
    max_length: int = 5000

class TranslateResponse(BaseModel):
    translated: str
    source: str
    target: str
    model: str

# OPUS-MT language pair mappings (Croatian → X)
# OPUS-MT pairs — Slavic→X for EU languages, fallback through English for others
OPUS_PAIRS = {
    # Direct Slavic→X (best quality for EU languages)
    "en": ("sla", "en"),
    "de": ("sla", "de"),
    "fr": ("sla", "fr"),
    "es": ("sla", "es"),
    "it": ("sla", "it"),
    "nl": ("sla", "nl"),
    "pt": ("sla", "gmq"),  # fallback to Scandinavian group
    "sv": ("sla", "sv"),
    "da": ("sla", "da"),
    "nb": ("sla", "nb"),   # Norwegian Bokmål
    "fi": ("sla", "fi"),
    "pl": ("sla", "zle"),  # Slavic→East Slavic (close enough for Polish)
    "cs": ("sla", "cs"),   # Czech direct
    "bg": ("zls", "zls"),  # South Slavic group
    "ro": ("sla", "ro"),
    "el": ("sla", "el"),
    "hu": ("sla", "hu"),
    # Non-EU: route through English (hr→en→target)
    "ar": ("en", "ar"),
    "zh": ("en", "zh"),
    "ja": ("en", "jap"),
    "uk": ("zle", "uk"),   # East Slavic → Ukrainian
}

# For non-EU languages, we do two-hop: Croatian→English→Target
TWO_HOP_LANGS = {"ar", "zh", "ja"}

@app.post("/api/nlp/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest):
    text = req.text[:req.max_length]
    target = req.target
    
    pair = OPUS_PAIRS.get(target)
    if not pair:
        raise HTTPException(400, f"Translation to \'{target}\' not supported. Supported: {list(OPUS_PAIRS.keys())}")
    
    src_group, tgt_group = pair
    
    # Two-hop for non-EU: first translate to English, then to target
    if target in TWO_HOP_LANGS:
        # Step 1: Croatian → English
        en_mt = get_translation_model("sla", "en")
        if en_mt:
            inputs = en_mt["tokenizer"](text, return_tensors="pt", truncation=True, max_length=512)
            outputs = en_mt["model"].generate(**inputs, max_length=512)
            text = en_mt["tokenizer"].decode(outputs[0], skip_special_tokens=True)
        src_group, tgt_group = "en", tgt_group
    
    model_name = f"Helsinki-NLP/opus-mt-{src_group}-{tgt_group}"
    mt = get_translation_model(src_group, tgt_group)
    
    if not mt:
        raise HTTPException(503, f"Translation model {model_name} not available")
    
    tokenizer = mt["tokenizer"]
    model = mt["model"]
    
    # Split into paragraphs for better translation
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    translated_parts = []
    
    for para in paragraphs:
        if len(para) < 3:
            translated_parts.append(para)
            continue
        # Chunk long paragraphs (OPUS-MT has 512 token limit)
        sentences = re.split(r'(?<=[.!?])\s+', para)
        chunk = ""
        for sent in sentences:
            if len(chunk) + len(sent) > 400:
                if chunk:
                    inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512)
                    outputs = model.generate(**inputs, max_length=512)
                    translated_parts.append(tokenizer.decode(outputs[0], skip_special_tokens=True))
                chunk = sent
            else:
                chunk = (chunk + " " + sent).strip()
        if chunk:
            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512)
            outputs = model.generate(**inputs, max_length=512)
            translated_parts.append(tokenizer.decode(outputs[0], skip_special_tokens=True))
    
    return TranslateResponse(
        translated="\n".join(translated_parts),
        source=req.source,
        target=target,
        model=model_name,
    )


# ============================================================================
# Batch processing endpoint
# ============================================================================

class BatchProcessRequest(BaseModel):
    decision_id: int
    language: str = "hr"
    features: list = ["ner", "classify", "outcome"]

class BatchProcessResponse(BaseModel):
    decision_id: int
    results: dict

@app.post("/api/nlp/process", response_model=BatchProcessResponse)
def batch_process(req: BatchProcessRequest):
    """Process a single decision through all NLP pipelines."""
    # Fetch decision text from DB
    text = subprocess.run(
        DB_CMD + [f"SELECT full_text_plain FROM court_decisions WHERE id = {req.decision_id};"],
        capture_output=True, text=True, timeout=10
    ).stdout.strip()
    
    if not text:
        raise HTTPException(404, "Decision not found or has no text")
    
    results = {}
    
    if "ner" in req.features:
        ner = extract_entities(NERRequest(text=text))
        results["ner"] = ner.entities
    
    if "classify" in req.features:
        cls = classify(ClassifyRequest(text=text))
        results["classification"] = {"primary": cls.primary_topic, "topics": cls.topics}
    
    if "outcome" in req.features:
        out = analyze_outcome(OutcomeRequest(text=text))
        results["outcome"] = {"outcome": out.outcome, "confidence": out.confidence, "details": out.details}
    
    if "summarize" in req.features:
        try:
            summ = summarize(SummarizeRequest(text=text, language=req.language))
            results["summary"] = summ.summary
        except Exception:
            results["summary"] = None
    
    if "similar" in req.features:
        sim = find_similar(SimilarityRequest(text=text[:2000]))
        results["similar"] = sim.similar
    
    return BatchProcessResponse(decision_id=req.decision_id, results=results)




# ============================================================================
# 7. Text-to-Speech (Piper TTS)
# ============================================================================

import subprocess as _sp
import tempfile as _tf
import base64 as _b64

PIPER_BIN = os.path.expanduser("~/.local/bin/piper")
PIPER_MODELS = "/opt/ai-elevate/models/piper"

PIPER_VOICE_MAP = {
    "ar": "ar_JO-kareem-medium", "bg": "bg_BG-dimitar-medium",
    "cs": "cs_CZ-jirka-medium", "da": "da_DK-talesyntese-medium",
    "de": "de_DE-mls-medium", "el": "el_GR-rapunzelina-medium",
    "en": "en_US-amy-medium", "es": "es_ES-davefx-medium",
    "fi": "fi_FI-harri-medium", "fr": "fr_FR-mls-medium",
    "hr": "sr_RS-serbski_institut-medium",  # Serbian fallback for Croatian
    "hu": "hu_HU-anna-medium", "is": "is_IS-bui-medium",
    "it": "it_IT-paola-medium", "lv": "lv_LV-aivars-medium",
    "nb": "no_NO-talesyntese-medium", "nl": "nl_NL-alex-medium",
    "pl": "pl_PL-darkman-medium", "pt": "pt_BR-cadu-medium",
    "ro": "ro_RO-mihai-medium", "sk": "sk_SK-lili-medium",
    "sl": "sl_SI-artur-medium", "sv": "sv_SE-alma-medium",
    "uk": "uk_UA-ukrainian_tts-medium", "zh": "zh_CN-chaowen-medium",
}

class TTSRequest(BaseModel):
    text: str
    language: str = "hr"
    max_length: int = 2000

@app.post("/api/nlp/tts")
def text_to_speech(req: TTSRequest):
    text = req.text[:req.max_length]
    lang = req.language
    
    voice = PIPER_VOICE_MAP.get(lang)
    if not voice:
        # Fall back to English
        voice = PIPER_VOICE_MAP.get("en", "en_US-amy-medium")
    
    model_path = os.path.join(PIPER_MODELS, f"{voice}.onnx")
    if not os.path.exists(model_path):
        raise HTTPException(404, f"Voice model not found for {lang}")
    
    with _tf.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        result = _sp.run(
            [PIPER_BIN, "--model", model_path, "--output_file", tmp_path],
            input=text.encode("utf-8"),
            capture_output=True, timeout=30
        )
        
        if result.returncode != 0:
            raise HTTPException(500, f"Piper TTS failed: {result.stderr.decode()[:200]}")
        
        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()
        
        audio_b64 = _b64.b64encode(audio_bytes).decode("ascii")
        
        return {
            "audio": audio_b64,
            "format": "wav",
            "language": lang,
            "voice": voice,
            "length_chars": len(text),
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

# ============================================================================
# Health check
# ============================================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": list(_models.keys()),
        "features": ["ner", "summarize", "similar", "classify", "outcome", "translate", "tts"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8026)
