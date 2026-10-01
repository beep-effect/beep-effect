// fallow-ignore-file code-duplication -- pre-existing story clones on main: the diff-attributed audit charges them to this change because its edited lines fall inside the clone ranges. Story variants repeat the canonical markup on purpose (the Storybook docs panel shows each story's source; shared render helpers would hide that usage). Review by 2026-12-31.
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@beep/ui/components/table";
import { A } from "@beep/utils";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

interface Invoice {
  readonly amount: string;
  readonly invoice: string;
  readonly method: string;
  readonly status: string;
}

const invoices: ReadonlyArray<Invoice> = [
  { invoice: "INV001", status: "Paid", method: "Credit Card", amount: "$250.00" },
  { invoice: "INV002", status: "Pending", method: "PayPal", amount: "$150.00" },
  { invoice: "INV003", status: "Unpaid", method: "Bank Transfer", amount: "$350.00" },
  { invoice: "INV004", status: "Paid", method: "Credit Card", amount: "$450.00" },
  { invoice: "INV005", status: "Paid", method: "PayPal", amount: "$550.00" },
];

/**
 * `Table` is a thin, styled wrapper over the native HTML table elements, giving you accessible
 * tabular layout with consistent borders, padding, and hover states. Compose the root `Table`
 * (which provides the horizontally scrollable container) with `TableHeader`/`TableBody`/`TableFooter`
 * sections, `TableRow` for each row, `TableHead` for column headers, and `TableCell` for data cells.
 * Add an optional `TableCaption` to describe the table for assistive technologies. Because each part
 * forwards to its underlying element (`<table>`, `<thead>`, `<tr>`, `<th>`, `<td>`, ...), every
 * native attribute and the `className` escape hatch are available.
 *
 * Imported from `@beep/ui/components/table`.
 */
const meta = {
  title: "Components/Data Display/Table",
  component: Table,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Additional classes merged onto the underlying `<table>` element.",
    },
    children: {
      control: false,
      description: "Composed table sections: `TableHeader`, `TableBody`, `TableFooter`, and `TableCaption`.",
    },
  },
  args: {},
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default table composes a header, body, and footer over a list of invoices. The play test
 * confirms the table renders with its accessible caption and the expected number of data rows.
 */
export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-25">Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {A.map(invoices, (row) => (
          <TableRow key={row.invoice}>
            <TableCell>
              <span className="font-medium">{row.invoice}</span>
            </TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.method}</TableCell>
            <TableCell className="text-right">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right">$1,750.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole("table");
    expect(table).toBeVisible();
    expect(canvas.getByText("A list of your recent invoices.")).toBeVisible();
    expect(canvas.getAllByRole("row")).toHaveLength(A.length(invoices) + 2);
    return Promise.resolve();
  },
};

/**
 * A minimal header-and-body table with no footer or caption, useful for compact data displays.
 */
export const Simple: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <span className="font-medium">Ada Lovelace</span>
          </TableCell>
          <TableCell>Engineer</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <span className="font-medium">Alan Turing</span>
          </TableCell>
          <TableCell>Researcher</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

/**
 * A `TableCaption` describes the table for assistive technology. The play test asserts the caption
 * text is rendered alongside the table.
 */
export const WithCaption: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Quarterly revenue by region.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Region</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>North America</TableCell>
          <TableCell className="text-right">$1.2M</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Europe</TableCell>
          <TableCell className="text-right">$0.9M</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Quarterly revenue by region.")).toBeVisible();
    return Promise.resolve();
  },
};

/**
 * A `TableFooter` summarizes the columns above it. Here a footer row spans the leading columns to
 * present a total aligned with the amount column.
 */
export const WithFooter: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Price</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Subscription</TableCell>
          <TableCell className="text-right">$29.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Add-on seats</TableCell>
          <TableCell className="text-right">$12.00</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">$41.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

/**
 * Rows expose a `data-state="selected"` attribute that applies the selected background styling. The
 * play test asserts the highlighted row carries the selected state.
 */
export const SelectedRow: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Owner</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Draft spec</TableCell>
          <TableCell>Grace</TableCell>
        </TableRow>
        <TableRow data-state="selected">
          <TableCell>Review PR</TableCell>
          <TableCell>Linus</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Ship release</TableCell>
          <TableCell>Margaret</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByText("Review PR").closest("tr");
    expect(selected).toHaveAttribute("data-state", "selected");
    return Promise.resolve();
  },
};

/**
 * Many rows demonstrate the horizontally scrollable container and consistent row striping driven by
 * hover styling. Rows are generated from the shared invoice fixture.
 */
export const ManyRows: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-25">Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {A.map(A.appendAll(invoices, invoices), (row, index) => (
          <TableRow key={`${row.invoice}-${index}`}>
            <TableCell>
              <span className="font-medium">{row.invoice}</span>
            </TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.method}</TableCell>
            <TableCell className="text-right">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
