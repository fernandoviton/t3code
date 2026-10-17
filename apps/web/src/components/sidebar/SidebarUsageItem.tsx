import { useAtomValue } from "@effect/atom-react";
import type { LimitPoolWindow } from "@t3tools/shared/usageLimits";
import { ChartNoAxesColumnIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { usePrimarySettings } from "../../hooks/useSettings";
import { environmentPresentations } from "../../state/presentation";
import { formatRelativeTimeLabel, formatUpcomingTimestamp } from "../../timestampFormat";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { PROVIDER_PRESENTATION } from "../usage/usageProviders";
import { selectClaudeUsageRings, USAGE_RING_WARN_PERCENT } from "./sidebarUsageRings.logic";

const SESSION_COLOR = PROVIDER_PRESENTATION.claude.color;
const WEEKLY_COLOR = PROVIDER_PRESENTATION.opencode.color;
const WARN_COLOR = "var(--destructive)";

function ringColor(window: LimitPoolWindow, color: string): string {
  return window.usedPercent >= USAGE_RING_WARN_PERCENT ? WARN_COLOR : color;
}

/** One arc of the gauge: a faint full track with the used share drawn clockwise from 12 o'clock. */
function Ring({
  radius,
  window,
  color,
}: {
  readonly radius: number;
  readonly window: LimitPoolWindow | null;
  readonly color: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const used = window ? Math.max(0, Math.min(100, window.usedPercent)) / 100 : 0;
  return (
    <>
      <circle
        cx={9}
        cy={9}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={2}
      />
      {window && used > 0 ? (
        <circle
          cx={9}
          cy={9}
          r={radius}
          fill="none"
          stroke={ringColor(window, color)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${used * circumference} ${circumference}`}
          transform="rotate(-90 9 9)"
        />
      ) : null}
    </>
  );
}

function LegendRow({
  label,
  window,
  color,
  now,
}: {
  readonly label: string;
  readonly window: LimitPoolWindow | null;
  readonly color: string;
  readonly now: number;
}) {
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  if (!window) return null;
  const nextReset = window.resets[0]?.at;
  return (
    <span className="flex items-center gap-2 tabular-nums">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: ringColor(window, color) }}
      />
      <span>
        {label} {window.usedPercent}% used
        {nextReset !== undefined
          ? ` · resets ${formatUpcomingTimestamp(new Date(nextReset).toISOString(), timestampFormat, now)}`
          : ""}
      </span>
    </span>
  );
}

const MINUTE = 60_000;

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The footer's Usage button. With Claude limits reported it draws two rings,
 * session outside and weekly inside, and hovering lists both with their
 * freshness; the popup is the whole view, so clicking does nothing. Without
 * them it is the plain chart icon that opens the Usage page.
 */
export function SidebarUsageItem({ onClick }: { readonly onClick: () => void }) {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  // Limits arrive through the presentation stream; the minute clock only keeps
  // the reset times and pooling honest between updates.
  const now = useMinuteClock();
  const rings = selectClaudeUsageRings(presentations, now);
  const label = rings
    ? [
        "Usage",
        rings.session ? `session ${rings.session.usedPercent}%` : null,
        rings.weekly ? `weekly ${rings.weekly.usedPercent}%` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "Usage";

  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton aria-label={label} onClick={rings ? undefined : onClick} size="icon">
              {rings ? (
                <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden>
                  <Ring radius={8} window={rings.session} color={SESSION_COLOR} />
                  <Ring radius={4.5} window={rings.weekly} color={WEEKLY_COLOR} />
                </svg>
              ) : (
                <ChartNoAxesColumnIcon />
              )}
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">
          {rings ? (
            <span className="flex flex-col gap-1">
              <span className="font-medium">Claude usage</span>
              <LegendRow label="Session" window={rings.session} color={SESSION_COLOR} now={now} />
              <LegendRow label="Weekly" window={rings.weekly} color={WEEKLY_COLOR} now={now} />
              <span className="text-muted-foreground">
                Updated {formatRelativeTimeLabel(rings.checkedAt)}
              </span>
            </span>
          ) : (
            "Usage"
          )}
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
