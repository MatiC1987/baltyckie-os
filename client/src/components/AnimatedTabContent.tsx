import { AnimatePresence, motion } from "framer-motion";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRef, useCallback } from "react";
import { haptic } from "@/lib/haptics";

interface AnimatedTabContentProps {
  value: string;
  activeValue: string;
  className?: string;
  children: React.ReactNode;
  tabValues?: string[];
  onTabChange?: (value: string) => void;
}

export function AnimatedTabContent({
  value,
  activeValue,
  className,
  children,
  tabValues,
  onTabChange,
}: AnimatedTabContentProps) {
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    swiping.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!tabValues || !onTabChange) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX.current;
    const dy = Math.abs(touch.clientY - startY.current);
    const absDx = Math.abs(dx);
    if (absDx < 50 || dy > absDx) return;

    const currentIndex = tabValues.indexOf(activeValue);
    if (currentIndex === -1) return;

    if (dx < 0 && currentIndex < tabValues.length - 1) {
      haptic("light");
      onTabChange(tabValues[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      haptic("light");
      onTabChange(tabValues[currentIndex - 1]);
    }
  }, [tabValues, onTabChange, activeValue]);

  return (
    <TabsContent value={value} className={cn("mt-0", className)} forceMount>
      <AnimatePresence mode="wait">
        {activeValue === value && (
          <motion.div
            key={value}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </TabsContent>
  );
}
