/** Payhero integration stub - payments disabled */
export async function payheroStkPush(_args: any) {
  return { status: "disabled", reference: "" };
}

export async function payheroTransactionStatus(_reference: string) {
  return { status: "disabled" };
}
