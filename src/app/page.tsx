"use client";
import dynamic from "next/dynamic";

const Board = dynamic(
  () => import("@/components/board/Board").then((m) => m.Board),
  { ssr: false }
);

export default function Home() {
  return <Board />;
}
