/**
 * The demo-request form. Until the request path is connected, a submit is
 * held on the page and says so; without JS the stub route sends the visitor
 * back to this section. Nothing is sent or stored.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { contact } from "@/content/copy";
import type { SubmitEvent } from "react";

const heldAtom = Atom.make(false);

/**
 * Renders the request-a-demo form.
 *
 * **Example** (Render the form)
 *
 * ```ts
 * import { ContactForm } from "@/components/ContactForm"
 * import { createElement } from "react"
 *
 * console.log(createElement(ContactForm).type === ContactForm)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ContactForm() {
  const held = useAtomValue(heldAtom);
  const setHeld = useAtomSet(heldAtom);
  const onSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setHeld(true);
  };

  return (
    <form className="form" action="/api/request-demo" method="post" data-wiring="pending" onSubmit={onSubmit}>
      <div className="form__row">
        <div className="field">
          <label htmlFor="demo-name">{contact.fields.name}</label>
          <input id="demo-name" name="name" type="text" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="demo-firm">{contact.fields.firm}</label>
          <input id="demo-firm" name="firm" type="text" autoComplete="organization" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="demo-email">{contact.fields.email}</label>
        <input id="demo-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="demo-stack">{contact.fields.stack}</label>
        <textarea id="demo-stack" name="stack" placeholder={contact.stackPlaceholder} />
      </div>
      <div className="form__foot">
        <button className="button button--primary" type="submit">
          {contact.submit}
        </button>
        <p className="form__note">{contact.wiringNote}</p>
      </div>
      {held ? (
        <p className="form__status" role="status" data-form-held>
          {contact.heldNote}
        </p>
      ) : null}
    </form>
  );
}
