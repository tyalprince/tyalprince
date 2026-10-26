import { Suspense } from "react";
import { FilesApp } from "@/components/files/files-app";

export const metadata = { title: "Files · Life OS" };

export default function FilesPage() {
  // FilesApp reads ?folder= / ?view= from the URL.
  return (
    <Suspense>
      <FilesApp />
    </Suspense>
  );
}
