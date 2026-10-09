/** The commonmark.js 0.31.2 surface used by the differential oracle. */
declare module "commonmark" {
	/** A parsed node; HTML rendering also consumes its internal tree links. */
	export interface Node {
		readonly _type: string;
	}

	/** The reference parser, reusable across independent inputs. */
	export class Parser {
		parse(input: string): Node;
	}

	/** The reference HTML renderer, reusable across independent trees. */
	export class HtmlRenderer {
		render(node: Node): string;
	}
}
