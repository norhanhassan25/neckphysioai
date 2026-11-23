# NECKPHYSIOAI bilingual + physiotherapy assistant update

- Language switcher with Arabic/English and persisted choice in localStorage, available on all pages.
- HTML direction updates automatically RTL / LTR.
- Landing, main assessment, NDI options, video page and main dashboard call-to-action are localized.
- Shared navigation labels and coach area labels have Arabic equivalents.
- The old Yoga assistant's persona and backend Gemini system prompts are now restricted to neck physiotherapy education; the assistant only responds live when GEMINI_API_KEY is configured on the backend.
- Dashboard's primary CTA opens the neck assessment, not the yoga pose library.
- Previous user accounts, DB migrations, credentials and tracking rules have not been modified.

## Not yet complete
Some inherited PhysioAlign pages (legacy analytics, admin/doctor dashboards, tracking details, onboarding error messages and legacy yoga session screens) still contain English text. Those must be fully localized before claiming the *entire site* bilingual. Coach chat messages returned by Gemini will follow the user's language as instructed, but existing chat history is not automatically translated.

Do not share or add your .env to any ZIP. After extracting, place your own .env beside package.json.
