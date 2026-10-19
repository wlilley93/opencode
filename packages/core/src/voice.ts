export * as Voice from "./voice.js"

import { type AIError } from "@opencode/ai"
import {
  Realtime,
  type RealtimeSession,
  type RealtimeTransport,
  type RealtimeTransportInput,
} from "@opencode/ai/experimental"
import { RequestExecutor } from "@opencode/ai/route"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { requestExecutor } from "./effect/app-node-platform.js"
import { Integration } from "./integration.js"

export interface SessionInput {
  readonly model: string
  readonly session?: RealtimeSession
  readonly transport: RealtimeTransportInput
}

export class InvalidRequestError extends Schema.TaggedError<InvalidRequestError>()("Voice.InvalidRequestError", {
  message: Schema.String,
}) {}

export class UnavailableError extends Schema.TaggedError<UnavailableError>()("Voice.UnavailableError", {
  message: Schema.String,
  service: Schema.optional(Schema.String),
}) {}

export type Error = InvalidRequestError | UnavailableError

export interface TranscribeInput {
  /** Base64 audio. */
  readonly audio: string
  readonly mimeType?: string
  readonly language?: string
}

export interface TranscribeOutput {
  readonly text: string
  readonly language?: string
}

export interface Interface {
  readonly session: (input: SessionInput) => Effect.Effect<RealtimeTransport, Error>
  readonly transcribe: (input: TranscribeInput) => Effect.Effect<TranscribeOutput, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Voice") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const executor = yield* RequestExecutor.Service
    const integrations = yield* Integration.Service

    const session = Effect.fn("Voice.session")(function* (input: SessionInput) {
      const engine = Realtime.engine(input.model)
      if (!engine) return yield* new InvalidRequestError({ message: `Unsupported voice model: ${input.model}` })

      // Integration lists the active credential first, then newer stored credentials, then its env vars.
      const connection = (yield* integrations.get(Integration.ID.make(engine.provider)))?.connections.find(
        (item) => item.type === "env" || item.method === "key",
      )
      const credential = connection
        ? yield* integrations.connection
            .resolve(connection)
            .pipe(
              Effect.mapError((error) => new UnavailableError({ service: engine.provider, message: error.message })),
            )
        : undefined
      if (credential?.type !== "key")
        return yield* new UnavailableError({
          service: engine.provider,
          message:
            engine.provider === "openai"
              ? "Voice needs an OpenAI API key on the server (a stored key or OPENAI_API_KEY). ChatGPT sign-in can't start voice sessions."
              : "Voice needs an xAI API key on the server (a stored key or XAI_API_KEY).",
        })

      return yield* Realtime.connect({ ...input, apiKey: Redacted.make(credential.key) }).pipe(
        Effect.provideService(RequestExecutor.Service, executor),
        Effect.mapError(
          (error: AIError): Error =>
            error.reason._tag === "InvalidRequest" || error.reason._tag === "UnsupportedOperation"
              ? new InvalidRequestError({ message: error.message })
              : new UnavailableError({ message: error.message, service: engine.provider }),
        ),
      )
    })

    /** ElevenLabs key: the environment first, then the helper's config file. */
    const speechKey = () => {
      if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY
      try {
        const config = JSON.parse(readFileSync(`${homedir()}/.config/opencode/voice.json`, "utf8")) as {
          apiKey?: string
        }
        return config.apiKey
      } catch {
        return undefined
      }
    }

    const transcribe = Effect.fn("Voice.transcribe")(function* (input: TranscribeInput) {
      const key = speechKey()
      if (!key)
        return yield* new UnavailableError({
          service: "elevenlabs",
          message:
            "Voice needs an ElevenLabs API key: set ELEVENLABS_API_KEY or add apiKey to ~/.config/opencode/voice.json.",
        })

      const form = new FormData()
      form.set("model_id", "scribe_v1")
      if (input.language) form.set("language_code", input.language)
      form.set(
        "file",
        new Blob([Buffer.from(input.audio, "base64")], { type: input.mimeType ?? "audio/webm" }),
        "audio.webm",
      )

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": key },
            body: form,
          }),
        catch: (error) =>
          new UnavailableError({ service: "elevenlabs", message: `Transcription request failed: ${error}` }),
      })

      if (!response.ok) {
        const detail = yield* Effect.tryPromise(() => response.text()).pipe(Effect.orElseSucceed(() => ""))
        return yield* new UnavailableError({
          service: "elevenlabs",
          message: `Transcription failed (${response.status}): ${detail.slice(0, 200)}`,
        })
      }

      const body = yield* Effect.tryPromise({
        try: () => response.json() as Promise<{ text?: string; language_code?: string }>,
        catch: () => new UnavailableError({ service: "elevenlabs", message: "Transcription returned invalid JSON" }),
      })

      return { text: (body.text ?? "").trim(), language: body.language_code }
    })

    return Service.of({ session, transcribe })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Integration.node, requestExecutor],
})
