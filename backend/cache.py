# cache.py - a tiny hand-rolled cache

_cache = {}

def get(key):
    if key in _cache:
        return _cache[key]
    return None

def set(key, value):
    _cache[key] = value

def clear():
    _cache.clear()

def make_key(endpoint: str, params: dict) -> str:
    parts = []
    for k in sorted(params):
        parts.append(f"{k}={params[k]}")
    return endpoint + "|" + "&".join(parts)