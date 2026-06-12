import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({ className, ...props }: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative w-full select-none", className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full touch-none items-center py-2">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-[#E5DFD4] dark:bg-slate-700">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-stone-500 dark:bg-slate-400" />
          <SliderPrimitive.Thumb className="size-4 rounded-full border border-[#D8D0C4] bg-white shadow-[0_1px_2px_rgba(57,47,38,0.18)] outline-none transition focus-visible:ring-2 focus-visible:ring-stone-400/60 dark:border-slate-600 dark:bg-slate-200" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
