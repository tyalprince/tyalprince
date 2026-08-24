"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { GeneratorPanel } from "./generator-panel";

export function QuickGeneratorButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Wand2 className="h-4 w-4" />
        <span className="hidden sm:inline">Generate password</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Password generator">
        <GeneratorPanel />
      </Dialog>
    </>
  );
}
