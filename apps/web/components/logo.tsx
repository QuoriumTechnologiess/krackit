export function LogoMark({ size = 150 }: { size?: number }) {
  return (
    <>
      <img
        src="/LightTheme.png"
        alt="krackit"
        width={size}
        height={size}
        className="block dark:hidden shrink-0"
        style={{ objectFit: "contain" }}
      />
      <img
        src="/DarkTheme.png"
        alt="krackit"
        width={size}
        height={size}
        className="hidden dark:block shrink-0"
        style={{ objectFit: "contain" }}
      />
    </>
  );
}

export function Krackit({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-cyan">krackIT</span>
    </span>
  );
}

export function Logo({
  size = 150,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`flex items-center ${className}`}>
      <LogoMark size={size} />
    </span>
  );
}
