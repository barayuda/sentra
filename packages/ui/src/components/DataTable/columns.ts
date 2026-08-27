/**
 * Column definition for {@link DataTable}. Lives in its own module because a
 * `<script setup>` block cannot export types (same split as Select's
 * options.ts).
 *
 * @typeParam Row - The row shape this column reads from.
 */
export interface ColumnDef<Row> {
  /** Row property name; also names the scoped cell slot (`cell-<key>`). */
  key: string
  /** Header text. */
  header: string
  /** Whether the header offers controlled sorting. */
  sortable?: boolean
  /** CSS width (e.g. `'12rem'`, `'20%'`); columns share space equally when omitted. */
  width?: string
  /**
   * Derives the displayed value. Defaults to `row[key]`. The scoped cell
   * slot, when provided, wins over both.
   */
  accessor?(row: Row): unknown
}
