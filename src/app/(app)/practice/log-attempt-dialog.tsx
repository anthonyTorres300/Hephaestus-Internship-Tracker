"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/feedback/toast";
import type { DsaTopic } from "@/lib/data/types";
import { AttemptForm } from "./attempt-form";

export function LogAttemptDialog(props: {
  topics: DsaTopic[];
  language: string;
  nowLocal: string;
  knownTitles: string[];
  prefill?: { title: string; url: string };
  defaultOpen?: boolean;
}) {
  const { defaultOpen, ...formProps } = props;
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const close = useCallback(
    (next: boolean) => {
      setOpen(next);
      // Opened from a recommendation (?log=…): drop the parameter once the dialog is dismissed.
      if (!next && props.prefill) router.replace("/practice", { scroll: false });
    },
    [props.prefill, router],
  );
  const toast = useToast();
  const onDone = useCallback(() => {
    close(false);
    toast({ message: "Attempt logged." });
  }, [toast, close]);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Log attempt
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log an attempt</DialogTitle>
            <DialogDescription>Only the title, result and date are required. Topics and difficulty can be added later.</DialogDescription>
          </DialogHeader>
          <AttemptForm {...formProps} onDone={onDone} />
        </DialogContent>
      </Dialog>
    </>
  );
}
