"use client";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const Board = dynamic(
  () => import("@/components/board/Board").then((m) => m.Board),
  { ssr: false }
);

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Board projectId={projectId} />;
}
