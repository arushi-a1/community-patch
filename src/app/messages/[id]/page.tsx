import { MessagesView } from "@/components/messages/MessagesView";

export const metadata = { title: "Messages — PATCH" };

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MessagesView activeId={id} />;
}
