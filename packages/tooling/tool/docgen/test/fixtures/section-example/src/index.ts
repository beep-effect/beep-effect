/**
 * Regression fixture for description-carried Example compilation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Supplies a typed value for the section-carried example fixture.
 *
 * **Example** (Compile a description-carried fence)
 *
 * ```ts
 * export {}
 *
 * const answer: number = 42
 * console.log(answer)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const sectionExample = 42;

/**
 * Owns a documented public property used by the member-example regression.
 *
 * @category fixtures
 * @since 0.0.0
 */
export class SectionExampleOwner {
  /**
   * Returns the fixture's stable numeric answer.
   *
   * **Example** (Read a public property)
   *
   * ```ts
   * import { SectionExampleOwner } from "../../src/index"
   *
   * const owner = new SectionExampleOwner()
   * console.log(owner.answer) // 42
   * ```
   */
  get answer(): number {
    return sectionExample;
  }
}
