import { InternalOrderDetailPage } from "@/src/components/internal-orders/internal-order-client";

export default async function InternalOrderPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <InternalOrderDetailPage internalOrderId={id} />;
}
