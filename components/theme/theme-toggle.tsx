"use client";

import { useTheme } from "@/lib/theme";
import { useHotkeys } from "react-hotkeys-hook";
import { Sun, Moon } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();

  useHotkeys("mod+shift+l", toggle, { preventDefault: true }, [toggle]);

  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "claro" : "escuro";
  const Icon = isDark ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Tema: ${isDark ? "escuro" : "claro"}. Alternar para ${nextTheme}.`}
      title={`Alternar para modo ${nextTheme}`}
    >
      <Icon size={16} aria-hidden />
    </Button>
  );
}
