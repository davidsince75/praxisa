import { cn } from "@/lib/utils.js";
import { usePrefersReducedMotion } from "@/pages/login/shared.js";

interface RorschachShadowProps {
  className?: string;
}

/*
 * Chorégraphie d'encre : chaque « goutte » est un cercle qui dérive
 * lentement entre quelques positions (boucle fermée, easing doux).
 * Le filtre flou + seuillage alpha fusionne les cercles voisins en
 * masses liquides — ils se rejoignent et se séparent comme de
 * l'encre dans l'eau. La colonne vertébrale est sur x = 240 ;
 * le miroir crée la symétrie de Rorschach.
 */
interface InkBlob {
  cx: readonly number[];
  cy: readonly number[];
  r: readonly number[];
  /** Durée d'un cycle complet (s). */
  dur: number;
  /** Décalage de phase (s, négatif = démarre en cours de cycle). */
  begin: number;
}

const BLOBS: readonly InkBlob[] = [
  // Couronne / tête (bande cy ≈ 80–126)
  {
    cx: [240, 232, 240],
    cy: [108, 96, 108],
    r: [34, 42, 34],
    dur: 15,
    begin: 0,
  },
  {
    cx: [214, 224, 206, 214],
    cy: [118, 104, 126, 118],
    r: [26, 34, 22, 26],
    dur: 17,
    begin: -5,
  },
  {
    cx: [228, 218, 234, 228],
    cy: [86, 98, 80, 86],
    r: [16, 24, 12, 16],
    dur: 12,
    begin: -8,
  },
  // Antenne au-dessus de la tête : apparaît puis s'évapore
  {
    cx: [240, 240, 240, 240],
    cy: [58, 70, 50, 58],
    r: [8, 16, 5, 8],
    dur: 13,
    begin: -3,
  },
  // Épaule : en rétrécissant, elle ouvre un « cou » dans la masse
  {
    cx: [206, 190, 212, 206],
    cy: [152, 162, 144, 152],
    r: [18, 28, 14, 18],
    dur: 14,
    begin: -2,
  },
  // Torse (bande cy ≈ 170–216)
  {
    cx: [236, 226, 240, 236],
    cy: [186, 174, 196, 186],
    r: [40, 50, 36, 40],
    dur: 19,
    begin: -10,
  },
  {
    cx: [210, 222, 200, 210],
    cy: [206, 190, 216, 206],
    r: [30, 40, 24, 30],
    dur: 16,
    begin: -6,
  },
  // Moignon de bras qui tend vers le « poing » latéral
  {
    cx: [188, 206, 180, 188],
    cy: [178, 190, 170, 178],
    r: [16, 26, 10, 16],
    dur: 13,
    begin: -1,
  },
  // Hanches et base (bande cy ≈ 240–290)
  {
    cx: [232, 220, 238, 232],
    cy: [252, 240, 262, 252],
    r: [34, 44, 30, 34],
    dur: 21,
    begin: -12,
  },
  {
    cx: [206, 196, 214, 206],
    cy: [274, 288, 264, 274],
    r: [22, 14, 28, 22],
    dur: 17,
    begin: -4,
  },
  // Goutte de queue sur la colonne
  {
    cx: [240, 240, 240],
    cy: [310, 294, 310],
    r: [14, 22, 14],
    dur: 15,
    begin: -7,
  },
  // Le « poing » latéral : un amas de trois gouttes qui se rapproche
  // de l'épaule puis s'en détache (cf. les masses latérales du film)
  {
    cx: [148, 170, 136, 148],
    cy: [142, 152, 134, 142],
    r: [24, 32, 18, 24],
    dur: 15,
    begin: -5,
  },
  {
    cx: [128, 150, 118, 128],
    cy: [128, 140, 118, 128],
    r: [16, 24, 10, 16],
    dur: 18,
    begin: -9,
  },
  {
    cx: [160, 146, 170, 160],
    cy: [170, 182, 160, 170],
    r: [12, 20, 8, 12],
    dur: 11,
    begin: -2,
  },
  // Satellites mi-hauteur et bas
  {
    cx: [116, 138, 104, 116],
    cy: [226, 210, 240, 226],
    r: [18, 26, 12, 18],
    dur: 19,
    begin: -7,
  },
  {
    cx: [96, 112, 86, 96],
    cy: [180, 196, 168, 180],
    r: [10, 16, 6, 10],
    dur: 12,
    begin: -10,
  },
  // Gouttelettes éparses : un petit rayon flouté passe sous le seuil
  // alpha, l'encre apparaît puis s'évapore d'elle-même
  {
    cx: [76, 84, 68, 76],
    cy: [250, 236, 262, 250],
    r: [4, 9, 2, 4],
    dur: 12,
    begin: -4,
  },
  {
    cx: [134, 126, 142, 134],
    cy: [302, 290, 312, 302],
    r: [6, 2, 9, 6],
    dur: 14,
    begin: -8,
  },
  {
    cx: [70, 78, 62, 70],
    cy: [120, 110, 130, 120],
    r: [3, 7, 2, 3],
    dur: 10,
    begin: -6,
  },
  {
    cx: [180, 172, 188, 180],
    cy: [330, 320, 340, 330],
    r: [5, 9, 2, 5],
    dur: 13,
    begin: -11,
  },
];

/** « a;b;c » -> « a;b;c;a » : boucle fermée, retour au point de départ. */
function loopValues(points: readonly number[]): string {
  return [...points, points[0]].join(";");
}

/** Une spline ease-in-out par transition de la boucle fermée. */
function easeSplines(transitionCount: number): string {
  return Array.from({ length: transitionCount }, () => "0.45 0 0.55 1").join(
    ";",
  );
}

interface DriftProps {
  attribute: "cx" | "cy" | "r";
  blob: InkBlob;
}

function Drift({ attribute, blob }: DriftProps) {
  const points = blob[attribute];
  return (
    <animate
      attributeName={attribute}
      values={loopValues(points)}
      dur={String(blob.dur) + "s"}
      begin={String(blob.begin) + "s"}
      repeatCount="indefinite"
      calcMode="spline"
      keySplines={easeSplines(points.length)}
    />
  );
}

/**
 * La tache de Rorschach en ombre de fond — un clin d'œil à
 * l'inconscient. De l'encre vivante : des masses symétriques qui
 * gonflent, fusionnent et se séparent en continu, bords rongés par
 * la turbulence et halo de diffusion comme sur du papier buvard.
 * Tout mouvement est désactivé si l'utilisateur réduit les animations.
 */
export function RorschachShadow({ className }: RorschachShadowProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <svg
        viewBox="0 0 480 400"
        className="h-[115vmin] w-auto max-w-none opacity-[0.085] lg:h-[125%] lg:min-h-[720px]"
      >
        <defs>
          <filter
            id="ps-ink-filter"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            {/* Fusion liquide : flou puis seuillage de l'alpha */}
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="11"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"
              result="goo"
            />
            {/* Bords rongés, irréguliers — l'encre n'est jamais nette */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.022"
              numOctaves="3"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="goo"
              in2="noise"
              scale="26"
              xChannelSelector="R"
              yChannelSelector="G"
              result="ink"
            />
            <feGaussianBlur in="ink" stdDeviation="1.4" result="core" />
            {/* Halo de diffusion : l'encre boit le papier */}
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="20"
              result="haloBlur"
            />
            <feColorMatrix
              in="haloBlur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
              result="halo"
            />
            <feMerge>
              <feMergeNode in="halo" />
              <feMergeNode in="core" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#ps-ink-filter)" fill="#1A1A18">
          <g id="ps-ink-half">
            {BLOBS.map((blob, index) => (
              <circle key={index} cx={blob.cx[0]} cy={blob.cy[0]} r={blob.r[0]}>
                {!reduced && (
                  <>
                    <Drift attribute="cx" blob={blob} />
                    <Drift attribute="cy" blob={blob} />
                    <Drift attribute="r" blob={blob} />
                  </>
                )}
              </circle>
            ))}
          </g>
          <use href="#ps-ink-half" transform="translate(480 0) scale(-1 1)" />
        </g>
      </svg>
    </div>
  );
}
