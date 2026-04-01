"""
AI Service — Mock implementation for Phase 1.

The interface (correct_sentence) is the contract. In Phase 2, replace the body
of this function with a real Claude API call. Nothing else in the app changes.

Real implementation will look like:
    import anthropic
    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-opus-4-6",
        messages=[{"role": "user", "content": prompt}],
    )
"""

import re

MISTAKE_TYPES = ("grammar", "spelling", "punctuation", "vocabulary", "no_mistake")


def correct_sentence(text: str) -> dict:
    """
    Analyze a sentence and return a correction result.

    Returns:
        {
            "corrected_text": str,
            "mistake_type": str,   # one of MISTAKE_TYPES
            "explanation": str,
        }
    """
    result = _apply_rules(text.strip())
    return result


# ---------------------------------------------------------------------------
# Mock rules — replace this entire section when connecting to real AI
# ---------------------------------------------------------------------------

_RULES = [
    # (pattern, replacement, type, explanation)
    (
        r"\bi\b",
        "I",
        "grammar",
        'The pronoun "I" is always capitalized in English.',
    ),
    (
        r"\bim\b",
        "I'm",
        "grammar",
        '"im" should be "I\'m" — a contraction of "I am".',
    ),
    (
        r"\bdont\b",
        "don't",
        "grammar",
        '"dont" is missing an apostrophe. The correct form is "don\'t".',
    ),
    (
        r"\bcant\b",
        "can't",
        "grammar",
        '"cant" is missing an apostrophe. The correct form is "can\'t".',
    ),
    (
        r"\bwont\b",
        "won't",
        "grammar",
        '"wont" is missing an apostrophe. The correct form is "won\'t".',
    ),
    (
        r"\bisnt\b",
        "isn't",
        "grammar",
        '"isnt" is missing an apostrophe. The correct form is "isn\'t".',
    ),
    (
        r"\bwasnt\b",
        "wasn't",
        "grammar",
        '"wasnt" is missing an apostrophe. The correct form is "wasn\'t".',
    ),
    (
        r"\btheir\s+is\b",
        "there is",
        "grammar",
        '"their" shows possession. Use "there" to refer to a place or existence.',
    ),
    (
        r"\bthere\s+going\b",
        "they're going",
        "grammar",
        'Use "they\'re" (they are) instead of "there" here.',
    ),
    (
        r"\byour\s+welcome\b",
        "you're welcome",
        "grammar",
        '"your" is possessive. Use "you\'re" (you are) here.',
    ),
    (
        r"\bgoed\b",
        "went",
        "grammar",
        '"goed" is not a word. The past tense of "go" is "went".',
    ),
    (
        r"\bteached\b",
        "taught",
        "grammar",
        '"teached" is not correct. The past tense of "teach" is "taught".',
    ),
    (
        r"\bteh\b",
        "the",
        "spelling",
        '"teh" is a common typo for "the".',
    ),
    (
        r"\brecieve\b",
        "receive",
        "spelling",
        'Remember the rule: "i before e except after c". Correct spelling is "receive".',
    ),
    (
        r"\boccured\b",
        "occurred",
        "spelling",
        '"occurred" has double "c" and double "r".',
    ),
    (
        r"\bseperate\b",
        "separate",
        "spelling",
        'Common misspelling. Remember: there is "a rat" in "sep-a-r-ate".',
    ),
    (
        r"\bdefenitely\b",
        "definitely",
        "spelling",
        'Common misspelling. "Definitely" contains "finite".',
    ),
]


def _apply_rules(text: str) -> dict:
    corrected = text
    found_type = "no_mistake"
    found_explanation = "Your sentence looks correct! No issues found."

    # Apply ALL matching rules (real AI does this naturally in one pass)
    for pattern, replacement, mistake_type, explanation in _RULES:
        new_text, count = re.subn(pattern, replacement, corrected, flags=re.IGNORECASE)
        if count > 0:
            corrected = new_text
            # Report the type/explanation of the first mistake found
            if found_type == "no_mistake":
                found_type = mistake_type
                found_explanation = explanation

    # Capitalize first letter
    if corrected:
        corrected = corrected[0].upper() + corrected[1:]

    # Ensure sentence ends with punctuation
    if corrected and corrected[-1] not in ".!?":
        corrected += "."
        if found_type == "no_mistake":
            found_type = "punctuation"
            found_explanation = "A sentence should end with punctuation (. ! or ?)."

    return {
        "corrected_text": corrected,
        "mistake_type": found_type,
        "explanation": found_explanation,
    }
