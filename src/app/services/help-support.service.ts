// src/app/services/help-support.service.ts
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { APIKeyManagementService } from './api-key-management.service';

type Role = 'user' | 'bot' | 'system';
export interface ChatMessage { id: string; role: Role; text: string; ts: number; }

export type ChatTopic =
  | 'psa_birth_certificate'
  | 'original_birth_certificate'
  | 'philsys_id'
  | 'voters_id_cert'
  | 'app_usage'
  | 'verification_flow'
  | 'privacy_security'
  | 'unknown';

// ---- UUID helper for mobile WebView
function makeUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'uuid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

@Injectable({ providedIn: 'root' })
export class HelpSupportService {
  private readonly BOT_NAME = 'DocVerify Assistant';
  private readonly GENERIC_REFUSAL =
    "Sorry—I'm designed to help with our Document Verification Checker only (PSA Birth Certificates, PhilSys National ID, Voter’s ID/Certification, app usage and verification steps). I can’t answer that question.";

  private conversation: ChatMessage[] = [];

  // ==== Gemini Throttling / Circuit breaker ====
  private readonly GEMINI_MIN_INTERVAL_MS = 1200;
  private readonly MAX_GEMINI_CALLS_PER_SESSION = 3;
  private readonly GEMINI_429_COOLDOWN_MS = 15 * 60_000;

  private lastGeminiCallAt = 0;
  private geminiCalls = 0;
  private geminiCooldownUntil = 0;

  private readonly GEMINI_MODELS = [
    () => environment?.gemini?.model || 'gemini-2.0-flash',
    () => 'gemini-2.0-flash',
    () => 'gemini-1.5-flash-8b',
  ];

  constructor(private readonly apiKeyManagementService: APIKeyManagementService) { }

  // ===== Basic public methods =====
  getConversation(): ChatMessage[] { return [...this.conversation]; }

  addSystemTip(text: string) {
    this.conversation = [...this.conversation, { id: makeUUID(), role: 'system', text, ts: Date.now() }];
  }

  addUserMessage(text: string): ChatMessage[] {
    const trimmed = (text || '').trim();
    if (!trimmed) return this.getConversation();
    this.conversation = [...this.conversation, { id: makeUUID(), role: 'user', text: trimmed, ts: Date.now() }];
    return this.getConversation();
  }

  async generateReplyForLastUser(): Promise<ChatMessage[]> {
    const lastUser = [...this.conversation].reverse().find(m => m.role === 'user');
    if (!lastUser) return this.getConversation();

    const botText = await this.generateBotReply(lastUser.text, this.conversation);
    this.conversation = [...this.conversation, { id: makeUUID(), role: 'bot', text: botText, ts: Date.now() }];
    return this.getConversation();
  }

  async getFAQs(): Promise<{ title: string; items: { q: string; a: string }[] }[]> {
    return [
      {
        title: 'Dos & Don’ts',
        items: [
          { q: 'Do: Scan the document QR if available', a: 'QR greatly improves verification confidence and speed.' },
          { q: 'Do: Upload clear, unedited images', a: 'Avoid glare, crops, or filters that obscure security features.' },
          { q: 'Don’t: Share full unredacted IDs publicly', a: 'Protect personal data per NPC privacy guidelines.' },
          { q: 'Don’t: Use this app to alter documents', a: 'We detect manipulation and will flag such attempts.' },
        ],
      },
      {
        title: 'App Basics',
        items: [
          { q: 'Where do I verify a document?', a: 'Use **Scan** for QR/2D barcode or **Upload** for photos/PDFs. Results appear in **Verification History**.' },
          { q: 'Where is my result?', a: 'Open **Verification History**. Tap any entry to view **Verification Details** including checks and flags.' },
          { q: 'Can you issue PSA/PhilSys/Comelec IDs?', a: 'No. We only check authenticity/consistency—not issue IDs.' },
        ],
      },
      { title: 'PSA Birth Certificate', items: this.KB.psa_birth_certificate.faqs ?? [] },
      { title: 'PhilSys (National ID)', items: this.KB.philsys_id.faqs ?? [] },
      { title: 'Voter’s Certification', items: this.KB.voters_id_cert.faqs ?? [] },
      {
        title: 'Privacy & Security',
        items: [{ q: 'Do you store my QR data?', a: 'By default, data stays on-device for this conversation unless you submit for manual review.' }],
      },
    ];
  }

  // ===== Debug toggles =====
  private readonly DEBUG = true;
  private readonly FORCE_ENRICH = true; // <--- force call AI for testing

  private log(...args: any[]) {
    if (this.DEBUG) console.log('[HelpSupportService]', ...args);
  }

  // ===== Knowledge Base =====
  private readonly KB: Record<
    ChatTopic,
    { patterns: RegExp[]; answer: string; faqs?: { q: string; a: string }[] }
  > = {
      psa_birth_certificate: {
        patterns: [/psa\b.*birth/i, /birth\s*cert/i, /psahelpline/i, /serbilis/i, /secpa/i],
        answer:
          "PSA Birth Certificates are issued on Security Paper (SECPA) and can be requested online via PSA-authorized portals (PSAHelpline or PSASerbilis) for delivery. For verifications, use our app’s **Upload** or **Scan** features to check QR/barcode details and consistency against record formats. Mismatches, altered images, or unreadable QR will be flagged for manual review.",
        faqs: [
          { q: 'Where can I request a PSA Birth Certificate online?', a: 'Via PSA-authorized portals like PSAHelpline or PSASerbilis (delivery nationwide and abroad).' },
          { q: 'What is SECPA?', a: 'PSA prints certificates on Security Paper (SECPA) with anti-counterfeit features. Older layouts remain valid if officially issued.' },
          { q: 'Can the app validate a PSA certificate without QR?', a: 'We can run heuristic checks (layout/fields), but QR/serial data greatly improves verification confidence.' },
        ],
      },
      original_birth_certificate: {
        patterns: [/original.*birth/i, /\bNSO\b/i, /local civil registrar/i],
        answer:
          'An “original” birth record originates from the Local Civil Registrar (LCR) and is transmitted to PSA for national issuance on SECPA. For legal/agency use, PSA-issued copies are typically required. Our checker focuses on PSA/PSA-format copies.',
      },
      philsys_id: {
        patterns: [/philsys/i, /national id/i, /\bpid\s*|pidus\b/i, /\bdigital national id\b/i],
        answer:
          'PhilSys (National ID) may be a physical card or paper format; both include a QR. You can validate formatting/QR readability with our app. Registration is done at PhilSys centers; the Digital National ID is accessible via eGovPH once verified.',
        faqs: [
          { q: 'How do I register for the National ID?', a: 'Visit PhilSys registration centers with supporting IDs. You can also generate a Digital National ID via the eGovPH app after verification.' },
          { q: 'Can your app verify the PhilSys QR?', a: 'We check QR readability and basic field consistency. We do not expose or store sensitive contents beyond what you see and approve.' },
        ],
      },
      voters_id_cert: {
        patterns: [/voter'?s?\s*(id|cert|certificate)/i, /comelec/i, /\bvc\b/i],
        answer:
          'COMELEC issues **Voter’s Certification** (not always a physical Voter’s ID). You may request it at your local OEO or designated offices; some locations allow electronic requests and fee exemptions for indigent applicants. Our app assists with format/field checks and QR/barcode readability when present.',
        faqs: [
          { q: 'Where to request a Voter’s Certification?', a: 'Usually at your Local COMELEC Office (OEO) where you’re registered; special desks exist in NCR/Intramuros for bulk/expedite.' },
          { q: 'What if the QR is damaged?', a: 'We’ll fall back to text/field checks and flag low-confidence results for manual review.' },
        ],
      },
      verification_flow: {
        patterns: [
          /(?:how|where)\s+(?:do\s+I\s+)?(?:verify|check)/i,
          /\bverify\b.*\b(document|id|certificate|psa|philsys|voter)/i,
          /\b(scan|upload)\b/i,
          /where.*(scan|verify|check|submit|upload)/i,
        ],
        answer:
          'Use **Scan** for live camera scanning (QR/2D barcode) or **Upload** to submit a photo/PDF. After processing, results appear in **Verification History** and you can open **Verification Details** for flags and checks.',
      },
      app_usage: {
        patterns: [
          /how to\b/i, /where to\b/i, /where (can|do) i\b/i,
          /\b(help & support|profile|history|details)\b/i,
          /\b(home|support|search)\b/i,
          /navigation|how.*use.*app/i,
          /where.*(scan|verify|upload|history|profile|help|support|details|search)/i,
          // NEW: capture result/history intents
          /\bresult(s)?\b/i, /\bhistory\b/i, /\bverification details?\b/i,
        ],
        answer:
          'What you can do: scan or upload PSA/PhilSys/Voter docs, view results, and track history. What we don’t do: issue official IDs/certificates, alter documents, or provide legal advice. See **Dos/Don’ts** in FAQs below.',
      },
      privacy_security: {
        patterns: [/privacy/i, /security/i, /data/i, /qr.*data/i, /consent/i, /store.*qr/i],
        answer:
          'We minimize personal data use and store only what’s needed for verification. Scanned data stays on-device unless you choose to submit for manual review. QR scans are handled with user consent and aligned with NPC guidance on transparency and purpose limitation.',
      },
      unknown: { patterns: [], answer: '' },
    };

  // ===== Topic detection =====
  private detectTopic(input: string): ChatTopic {
    const q = input.toLowerCase();
    const order: ChatTopic[] = [
      'verification_flow', 'app_usage', 'psa_birth_certificate', 'philsys_id',
      'voters_id_cert', 'original_birth_certificate', 'privacy_security',
    ];
    for (const topic of order) if (this.KB[topic]?.patterns.some(r => r.test(q))) return topic;
    return 'unknown';
  }

  // ===== Should Enrich (rewritten for clarity + debug) =====
  private shouldEnrich(input: string, topic: ChatTopic): boolean {
    const key = this.apiKeyManagementService?.currentAPIKey?.apiKey ?? '';
    const now = Date.now();

    // debugging info
    this.log('shouldEnrich check:', {
      hasKey: !!key,
      cooldown: this.geminiCooldownUntil > now,
      calls: this.geminiCalls,
      topic,
      textLength: input.length,
    });

    if (!key) return false;
    if (this.FORCE_ENRICH) return true; // <-- always enrich for debug
    if (now < this.geminiCooldownUntil) return false;
    if (this.geminiCalls >= this.MAX_GEMINI_CALLS_PER_SESSION) return false;
    if (['unknown', 'app_usage', 'verification_flow'].includes(topic)) return false;

    // basic length gate
    return input.trim().length > 10;
  }

  // ===== Reply generator =====
  private async generateBotReply(input: string, convo: ChatMessage[]): Promise<string> {
    const topic = this.detectTopic(input);
    const base = this.KB[topic]?.answer || this.GENERIC_REFUSAL;

    if (!this.shouldEnrich(input, topic)) {
      this.log('🟡 Skipping Gemini call (base only)');
      return base;
    }

    try {
      this.log('🟢 Calling Gemini enrichment...');
      const enriched = await this.askGeminiStrict(base, input, convo);
      if (enriched && enriched.length > 2) {
        this.log('✅ Gemini success');
        return enriched.trim();
      }
      this.log('⚠️ Gemini returned null or short output');
    } catch (err) {
      console.error('❌ Gemini error', err);
    }
    return base;
  }

  // ===== Gemini call =====
  private async askGeminiStrict(baseAnswer: string, userInput: string, memory: ChatMessage[]): Promise<string | null> {
    const now = Date.now();
    const since = now - this.lastGeminiCallAt;
    if (since < this.GEMINI_MIN_INTERVAL_MS)
      await new Promise(r => setTimeout(r, this.GEMINI_MIN_INTERVAL_MS - since));
    this.lastGeminiCallAt = Date.now();

    const key = this.apiKeyManagementService?.currentAPIKey?.apiKey;
    if (!key) {
      this.log('No Gemini key available.');
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(key);

    const recent = memory.slice(-4).map(m => `${m.role}: ${m.text}`).join('\n');

    const buildModel = (modelName: string) =>
      client.getGenerativeModel({
        model: modelName,
        systemInstruction: {
          role: 'system',
          parts: [{
            text: `You are "${this.BOT_NAME}", a help bot for a Document Verification Checker.
Scope: PSA Birth Certificates (SECPA), PhilSys (National ID), COMELEC Voter’s ID/Certification.
Rules: 1) Stay strictly in scope. 2) For in-scope questions, do NOT refuse. 3) If unsure, return the "Base answer" verbatim.
4) No legal advice. 5) Keep it concise (2–6 sentences).`
          }],
        },
      });

    const mkUserContent = (base: string, q: string, hist: string) => ({
      role: 'user' as const,
      parts: [{
        text: `Base answer: ${base}\n${hist ? `Recent:\n${hist}\n` : ''}Question: ${q}\n\nTask: Rephrase or expand the Base answer directly addressing the question. Keep it in scope. If you cannot improve, return Base answer verbatim.`
      }],
    });

    this.geminiCalls++;
    for (const modelGetter of this.GEMINI_MODELS) {
      const modelName = modelGetter();
      try {
        const model = buildModel(modelName);
        this.log('Generating via model:', modelName);
        const res = await model.generateContent({
          contents: [mkUserContent(baseAnswer, userInput, recent)],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        });
        const out = res?.response?.text?.() ?? '';
        if (out.trim()) return out.trim();
      } catch (err: any) {
        const msg = String(err?.message || '');
        this.log(`Model ${modelName} failed: ${msg}`);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))
          this.geminiCooldownUntil = Date.now() + this.GEMINI_429_COOLDOWN_MS;
      }
    }
    return null;
  }
}
