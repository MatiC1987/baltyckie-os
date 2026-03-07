import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReactNode } from "react";

interface ResponsiveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  className,
}: ResponsiveFormDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[95dvh] flex flex-col p-0 rounded-t-xl"
          data-testid="sheet-form-mobile"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 mobile-form-stack">
              {children}
            </div>
          </ScrollArea>
          {footer && (
            <SheetFooter className="px-4 py-3 border-t shrink-0">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className || "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        {footer && (
          <DialogFooter>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
