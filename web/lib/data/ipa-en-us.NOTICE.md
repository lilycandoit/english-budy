# IPA English (US) Wordlist

Source: [open-dict-data/ipa-dict](https://github.com/open-dict-data/ipa-dict), `data/en_US.txt`.

License: MIT (Copyright (c) 2016 dohliam).

Vendored as `ipa-en-us.json` (word → array of IPA transcriptions) so the app
can look up a verified pronunciation instead of relying solely on LLM-guessed
IPA, which can hallucinate incorrect stress placement.
