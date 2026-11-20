import { lgdCoverage } from "@/lib/lgd-coverage";
import { cn } from "@/lib/utils";
import { StateMap } from "./StateMap";

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * Hero artwork until the owner adds a photograph (public/assets/hero/citizens.webp): the state drawn
 * from the installed district boundaries, with the real coverage of the LGD data beside it.
 */
export function HeroMap({ className }: { className?: string }) {
  const c = lgdCoverage();
  return (
    <figure className={cn("absolute inset-0 m-0 flex items-end justify-center gap-10 px-6 pb-[4.5rem] pt-5 lg:items-center lg:justify-end lg:py-6 lg:pr-[8%]", className)}>
      <StateMap className="aspect-[345/290] h-[150px] w-auto sm:h-[180px] lg:h-full lg:max-h-[250px] xl:max-h-[300px]" />
      {c && (
        <figcaption className="hidden max-w-[16rem] border-l-2 border-brand-600 pl-4 text-[15px] leading-snug text-ink-700 xl:block">
          Built on the Local Government Directory: {fmt(c.districts)} districts, {fmt(c.mandals)} mandals, {fmt(c.gramPanchayats)} Gram
          Panchayats, {fmt(c.urbanLocalBodies)} towns and cities, and {fmt(c.wards)} wards.
        </figcaption>
      )}
    </figure>
  );
}
