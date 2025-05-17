export interface IInvoiceHandler {
  handleInvoice(invoice: string): Promise<boolean>;
}