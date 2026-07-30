/**
 * Native OIP contact form.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { $OipWebId } from "@beep/identity";
import { EmailString } from "@beep/schema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { OipContactHttpApiClient } from "../contact/ContactSubmission.http.ts";
import { ContactSubmissionStatus, contactSubmissionPayloadFromFormData } from "../contact/ContactSubmission.model.ts";

const $I = $OipWebId.create("components/ContactForm");
const inputClass =
  "min-h-11 rounded-md border border-[color-mix(in_oklab,var(--oip-on-soil)_22%,transparent)] bg-[color-mix(in_oklab,var(--oip-soil)_18%,transparent)] px-3 py-2 text-sm text-[var(--oip-on-soil)] outline-none transition-colors placeholder:text-[color-mix(in_oklab,var(--oip-on-soil)_52%,transparent)] focus:border-[var(--oip-gold)] focus:ring-3 focus:ring-[color-mix(in_oklab,var(--oip-gold)_35%,transparent)]";
const labelClass = "grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--oip-on-burgundy-accent)]";
const submitButtonClass =
  "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-transparent bg-primary bg-clip-padding px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";
const submittedAtAtom = Atom.make(0);
const submitContactAtom = OipContactHttpApiClient.mutation("contact", "submit");
const contactReactivityKeys = ["oip-contact"] as const;

const HTMLFormElementCtor = globalThis.HTMLFormElement;
const isHTMLFormElement = (value: unknown): value is HTMLFormElement =>
  P.isFunction(HTMLFormElementCtor) && value instanceof HTMLFormElementCtor;

const DOMHtmlFormElement = S.declare(isHTMLFormElement).pipe(
  $I.annoteSchema("DOMHtmlFormElement", {
    description: "A browser HTML form element.",
  })
);

class SubmitContactForm extends S.Class<SubmitContactForm>($I`SubmitContactForm`)(
  {
    form: DOMHtmlFormElement,
    initialSubmittedAt: S.Finite,
  },
  $I.annote("SubmitContactForm", {
    description: "A form for submitting contact information.",
  })
) {}

const currentTimestamp = (): number => Math.trunc(globalThis.performance.timeOrigin + globalThis.performance.now());

const effectiveSubmittedAtAtom = Atom.family((initialSubmittedAt: number) =>
  Atom.make((get) => {
    const submittedAt = get(submittedAtAtom);
    return submittedAt > 0 ? submittedAt : initialSubmittedAt;
  })
);

const nextSubmittedAt = (submittedAt: number, initialSubmittedAt: number): number =>
  submittedAt > 0 ? submittedAt : initialSubmittedAt > 0 ? initialSubmittedAt : currentTimestamp();

const markContactStartedAtom = Atom.writable(
  (get) => get(submittedAtAtom),
  (ctx, initialSubmittedAt: number) => {
    if (ctx.get(submittedAtAtom) <= 0 && initialSubmittedAt <= 0) {
      ctx.set(submittedAtAtom, currentTimestamp());
    }
  }
);

const submitContactFormAtom = Atom.writable(
  (get) => get(submitContactAtom),
  (ctx, { form, initialSubmittedAt }: SubmitContactForm) => {
    const submittedAt = ctx.get(submittedAtAtom);
    const next = nextSubmittedAt(submittedAt, initialSubmittedAt);

    if (submittedAt <= 0) {
      ctx.set(submittedAtAtom, next);
    }

    const formData = new FormData(form);
    formData.set("submittedAt", `${next}`);

    ctx.set(submitContactAtom, {
      payload: contactSubmissionPayloadFromFormData(formData),
      reactivityKeys: contactReactivityKeys,
    });
  }
);

class ContactFormProps extends S.Class<ContactFormProps>($I`ContactFormProps`)(
  {
    email: EmailString,
    initialSubmittedAt: S.Finite,
    status: S.UndefinedOr(ContactSubmissionStatus),
  },
  $I.annote("ContactFormProps", {
    description: "The return type of the ContactForm component.",
  })
) {}

/**
 * Renders the OIP contact form.
 *
 * @example
 * ```tsx
 * import { ContactForm } from "@beep/oip-web/components/ContactForm"
 *
 * const form = <ContactForm email="tom@example.com" initialSubmittedAt={0} status={undefined} />
 * console.log(form.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ContactForm({ email, initialSubmittedAt, status }: ContactFormProps) {
  const effectiveSubmittedAt = useAtomValue(effectiveSubmittedAtAtom(initialSubmittedAt));
  const markStarted = useAtomSet(markContactStartedAtom);
  const submitForm = useAtomSet(submitContactFormAtom);
  const submitResult = useAtomValue(submitContactAtom);
  const isSubmitting = AsyncResult.isWaiting(submitResult);
  const submittedStatus = AsyncResult.matchWithWaiting(submitResult, {
    onDefect: () => "rejected" as const,
    onError: () => "rejected" as const,
    onSuccess: (result) => result.value.status,
    onWaiting: () => undefined,
  });
  const contactStatus = submittedStatus ?? status;
  const statusMessage = isSubmitting
    ? "Sending note..."
    : contactStatus === "accepted"
      ? "Your note was received."
      : null;
  const isRejected = !isSubmitting && contactStatus === "rejected";

  return (
    <form
      action="/api/contact"
      className="grid gap-4 rounded-lg border border-[color-mix(in_oklab,var(--oip-on-soil)_22%,transparent)] bg-[color-mix(in_oklab,var(--oip-soil)_30%,transparent)] p-6"
      method="post"
      onFocus={() => markStarted(initialSubmittedAt)}
      onSubmit={(event) => {
        event.preventDefault();
        submitForm({ form: event.currentTarget, initialSubmittedAt });
      }}
    >
      <input aria-hidden="true" className="hidden" name="website" tabIndex={-1} autoComplete="off" />
      <input name="submittedAt" type="hidden" value={effectiveSubmittedAt} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input className={inputClass} name="name" required minLength={2} autoComplete="name" />
        </label>
        <label className={labelClass}>
          Email
          <input className={inputClass} name="email" required type="email" autoComplete="email" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Company
          <input className={inputClass} name="company" autoComplete="organization" />
        </label>
        <label className={labelClass}>
          Phone
          <input className={inputClass} name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>
      <label className={labelClass}>
        Technology
        <input className={inputClass} name="technology" />
      </label>
      <label className={labelClass}>
        Message
        <textarea className={`${inputClass} min-h-32 resize-y`} name="message" required minLength={12} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={submitButtonClass} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send note"}
        </button>
        <a
          className="font-[family-name:var(--font-oip-mono)] text-xs uppercase tracking-[0.12em] text-[var(--oip-on-burgundy-accent)]"
          href={`mailto:${email}`}
        >
          Email directly
        </a>
      </div>
      <p
        className="text-sm text-[var(--oip-gold-bright)] empty:hidden"
        id="contact-form-status"
        role={statusMessage === null ? undefined : "status"}
      >
        {statusMessage}
      </p>
      {isRejected && (
        <p className="text-sm text-[color-mix(in_oklab,var(--oip-on-soil)_88%,transparent)]" role="status">
          Your note could not be sent here. Email directly instead.
        </p>
      )}
    </form>
  );
}
