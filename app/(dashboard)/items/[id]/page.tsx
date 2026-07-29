import { ItemForm } from "@/src/components/items/item-form";

export default async function EditItemPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return <ItemForm itemId={id} />;
}
