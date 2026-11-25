# Development requirements

- Browser-only website; no required desktop software, Ollama or local server installation by the user.
- Preserve existing modules, data and main branch until changes are tested.
- Keep Gemini optional; API availability or subscription expiry must not prevent core practice.
- Prefer open-source browser technologies. Optional local browser AI models must require explicit download consent and show size; no automatic large downloads.
- Never automatically incur paid API charges. Clearly indicate provider availability and fallback limitations.
- Low bandwidth: lazy-load modules and datasets, cache versioned static assets where safe, avoid unnecessary polling and large initial downloads.
- English voice practice and Telugu voice explanations: browser speech capabilities first, explicit microphone consent, text fallback, no fabricated pronunciation scores.
- Expand typing, shortcuts, analytics exercises and datasets incrementally. Preserve existing progress.
- Test build, type checking, browser behavior and provider failure before merging. Report untested behavior honestly.
- Hosting must support existing server and persistence requirements; do not promise unlimited free hosting.
