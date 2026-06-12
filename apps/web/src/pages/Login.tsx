import { Navigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/lib/utils.js";
import { EyeWordmark } from "@/pages/login/EyeWordmark.js";
import { LoginCard } from "@/pages/login/LoginCard.js";
import { RorschachShadow } from "@/pages/login/RorschachShadow.js";
import { useCycleWords, useReveal } from "@/pages/login/shared.js";

function roleBasedHome(role: string): string {
  if (role === "admin") return "/";
  if (role === "instructor") return "/teacher/courses";
  return "/learn/catalog";
}

/** Facultés mentales qui défilent dans le titre. */
const FACULTES = [
  "la mémoire",
  "la perception",
  "l'émotion",
  "l'attention",
  "l'inconscient",
  "le langage",
] as const;

/** Disciplines et parcours du bandeau défilant — décoratif. */
const DISCIPLINES = [
  "Psychologie",
  "Psychologie de l'enfant",
  "Psychothérapie intégrative",
  "Parcours de compétences pratiques",
  "Initiation au travail sur soi",
  "Supervision",
  "Psychanalyse",
  "Neurosciences",
  "Mémoire & apprentissage",
  "Éthique clinique",
] as const;

const DOT_COLORS = ["text-teal", "text-rose", "text-olive"] as const;

interface Methode {
  numero: string;
  icon: LucideIcon;
  titre: string;
  texte: string;
  accent: string;
}

const METHODE: Methode[] = [
  {
    numero: "01",
    icon: BookOpen,
    titre: "Deux modules complets",
    texte:
      "Psychologie et psychologie de l'enfant : des cours complets, accessibles et régulièrement mis à jour.",
    accent: "text-teal",
  },
  {
    numero: "02",
    icon: Brain,
    titre: "Accompagnement personnalisé",
    texte:
      "Un suivi individuel jusqu'au certificat, épaulé par un tuteur IA qui répond à partir de vos cours.",
    accent: "text-rose",
  },
  {
    numero: "03",
    icon: ClipboardCheck,
    titre: "Évaluations encadrées",
    texte:
      "Quiz notés, travaux corrigés et retours détaillés, selon votre progression.",
    accent: "text-olive",
  },
  {
    numero: "04",
    icon: BadgeCheck,
    titre: "Certificat de capacités",
    texte:
      "Votre parcours est suivi pas à pas, jusqu'à l'obtention de votre certificat de capacités.",
    accent: "text-teal",
  },
];

/** Les chiffres de l'école — repris du site Psychostudy. */
const CHIFFRES = [
  { valeur: "480 h", legende: "de formation estimées par module" },
  { valeur: "24 mois", legende: "au maximum pour chaque module" },
  { valeur: "30 jours", legende: "pour tester votre formation" },
  { valeur: "Accessible", legende: "tout public — inscriptions permanentes" },
] as const;

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const faculte = useCycleWords(FACULTES, 3600);
  const methodeHead = useReveal<HTMLDivElement>();
  const methodeGrid = useReveal<HTMLDivElement>();
  const chiffres = useReveal<HTMLDivElement>();
  const citation = useReveal<HTMLElement>();

  if (isAuthenticated && user !== null) {
    return <Navigate to={roleBasedHome(user.role)} replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-cream text-dark">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>

      {/* Grain papier — décoratif, au-dessus de tout sauf du skip link */}
      <div
        aria-hidden="true"
        className="texture-grain pointer-events-none fixed inset-0 z-40"
      />

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <EyeWordmark className="text-2xl text-dark" />
          <nav
            aria-label="Navigation principale"
            className="flex items-center gap-8"
          >
            <a
              href="#programme"
              className="link-ink hidden text-sm font-semibold uppercase tracking-widest text-mid sm:inline-block"
            >
              La méthode
            </a>
            <Button
              asChild
              variant="outline"
              className="border-dark/30 bg-transparent text-dark transition-colors duration-300 hover:bg-dark hover:text-cream"
            >
              <a href="#connexion">Se connecter</a>
            </Button>
          </nav>
        </div>
      </header>

      <main id="contenu" tabIndex={-1}>
        {/* ——— Héro ——— */}
        <section className="relative">
          {/* L'inconscient en toile de fond : la tache de Rorschach
              emplit la page et se métamorphose lentement. */}
          <RorschachShadow />

          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 pb-20 pt-32 lg:min-h-screen lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-24 lg:pt-36">
            {/* Colonne éditoriale */}
            <div>
              <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.22em] text-teal-dark">
                <span aria-hidden="true" className="mr-2 text-rose">
                  ◆
                </span>
                Le spécialiste de la formation en psychologie
              </p>

              <h1 className="mt-6 animate-fade-up font-display text-[2.6rem] leading-[1.06] tracking-tight text-dark [animation-delay:90ms] sm:text-6xl sm:leading-[1.04] lg:text-7xl">
                Étudiez
                <span className="block">la psychologie,</span>
                <span className="block">à votre rythme.</span>
              </h1>

              {/* Le mot qui tourne vit sur sa propre ligne, sous le titre :
                  aucune des facultés ne dépasse 13 caractères, la mise en
                  page ne se recompose jamais pendant le cycle. */}
              <p className="mt-5 animate-fade-up font-display text-xl italic text-rose [animation-delay:140ms] sm:text-2xl">
                Au programme&nbsp;:{" "}
                <span key={faculte} className="inline-block animate-word-in">
                  {faculte}.
                </span>
              </p>

              <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-mid [animation-delay:180ms]">
                Une formation en ligne structurée pour découvrir, comprendre et
                approfondir la psychologie selon votre progression — des cours
                complets, accessibles et régulièrement mis à jour.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-7 animate-fade-up [animation-delay:260ms]">
                <Button
                  asChild
                  size="lg"
                  className="group bg-dark text-cream transition-colors duration-300 hover:bg-teal"
                >
                  <a href="#connexion">
                    Commencer la séance
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </a>
                </Button>
                <a
                  href="#programme"
                  className="link-ink inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-teal-dark"
                >
                  La méthode
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <p className="mt-8 animate-fade-up font-display text-sm italic text-mid [animation-delay:420ms]">
                Limitez vos contraintes — étudiez de chez vous.
              </p>
            </div>

            {/* Colonne connexion */}
            <div className="relative animate-fade-up [animation-delay:240ms]">
              {/* Éclats de couleur */}
              <div
                aria-hidden="true"
                className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-teal/25 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-14 -right-8 h-48 w-48 rounded-full bg-rose/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -right-16 top-24 h-40 w-40 rounded-full bg-sand/40 blur-2xl"
              />
              {/* Grille de points */}
              <div
                aria-hidden="true"
                className="absolute -bottom-8 -left-16 hidden h-44 w-44 opacity-70 [background-image:radial-gradient(#A8B5BE_1.5px,transparent_1.5px)] [background-size:14px_14px] lg:block"
              />

              <LoginCard
                onLogin={login}
                className="relative z-10 mx-auto w-full max-w-md"
              />

              {/* Badge circulaire tournant */}
              <div
                aria-hidden="true"
                className="absolute -top-14 right-0 z-20 hidden lg:block"
              >
                <svg
                  viewBox="0 0 120 120"
                  className="h-28 w-28 animate-[spin_22s_linear_infinite_reverse]"
                >
                  <defs>
                    <path
                      id="ps-badge-circle"
                      d="M60 10 a50 50 0 1 1 -0.01 0"
                      fill="none"
                    />
                  </defs>
                  <text className="fill-dark font-sans text-[10px] font-semibold uppercase tracking-[0.2em]">
                    <textPath href="#ps-badge-circle">
                      Psychostudy · sciences de l'esprit ·
                    </textPath>
                  </text>
                  <circle cx="60" cy="60" r="5" className="fill-rose" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Bandeau des disciplines ——— */}
        <div
          aria-hidden="true"
          className="relative overflow-hidden border-y border-rule bg-cream-mid/70 py-4"
        >
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {[0, 1].map((copie) => (
              <ul key={copie} className="flex shrink-0 items-center">
                {DISCIPLINES.map((discipline, index) => (
                  <li
                    key={discipline}
                    className="flex items-center whitespace-nowrap px-6 text-sm font-semibold uppercase tracking-[0.18em] text-mid"
                  >
                    <span
                      className={cn(
                        "mr-6 text-base",
                        DOT_COLORS[index % DOT_COLORS.length],
                      )}
                    >
                      ◆
                    </span>
                    {discipline}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        {/* ——— La méthode ——— */}
        <section
          id="programme"
          aria-labelledby="programme-titre"
          className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:py-32"
        >
          <div
            ref={methodeHead.ref}
            className={cn(
              "reveal max-w-2xl",
              methodeHead.visible && "is-visible",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose">
              La méthode
            </p>
            <h2
              id="programme-titre"
              className="mt-4 font-display text-3xl leading-tight tracking-tight text-dark sm:text-5xl"
            >
              Un cabinet d'étude complet,{" "}
              <span className="italic text-teal">dans votre navigateur.</span>
            </h2>
          </div>

          <div
            ref={methodeGrid.ref}
            className="mt-14 grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4"
          >
            {METHODE.map((etape, index) => {
              const Icon = etape.icon;
              return (
                <article
                  key={etape.numero}
                  className={cn(
                    "reveal bg-cream",
                    methodeGrid.visible && "is-visible",
                  )}
                  style={{ transitionDelay: String(index * 90) + "ms" }}
                >
                  <div className="group relative h-full p-7 transition-all duration-500 hover:-translate-y-1.5 hover:bg-white">
                    <div className="flex items-start justify-between">
                      <Icon
                        className={cn(
                          "h-6 w-6 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110",
                          etape.accent,
                        )}
                        aria-hidden="true"
                      />
                      <span
                        aria-hidden="true"
                        className="select-none font-display text-4xl leading-none text-rule transition-colors duration-500 group-hover:text-sand"
                      >
                        {etape.numero}
                      </span>
                    </div>
                    <h3 className="mt-10 text-base font-semibold text-dark">
                      {etape.titre}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-mid">
                      {etape.texte}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Les chiffres de l'école */}
          <div
            ref={chiffres.ref}
            className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4"
          >
            {CHIFFRES.map((chiffre, index) => (
              <div
                key={chiffre.valeur}
                className={cn("reveal", chiffres.visible && "is-visible")}
                style={{ transitionDelay: String(index * 90) + "ms" }}
              >
                <p className="font-display text-4xl tracking-tight text-dark sm:text-5xl">
                  {chiffre.valeur}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-meta">
                  {chiffre.legende}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ——— Citation ——— */}
        <section className="border-t border-rule bg-cream-mid/60">
          <figure
            ref={citation.ref}
            className={cn(
              "reveal mx-auto max-w-3xl px-6 py-24 text-center lg:py-28",
              citation.visible && "is-visible",
            )}
          >
            <span
              aria-hidden="true"
              className="font-display text-7xl leading-none text-sand"
            >
              «
            </span>
            <blockquote className="mt-2 font-display text-2xl italic leading-snug text-dark sm:text-4xl">
              Qui regarde dehors rêve&nbsp;; qui regarde dedans s'éveille.
            </blockquote>
            <figcaption className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-meta">
              Carl Gustav Jung
            </figcaption>
          </figure>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-dark text-cream">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[16vw] leading-none text-white/[0.04]"
        >
          Psychostudy
        </p>
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <EyeWordmark tone="paper" className="text-2xl" />
            <p className="mt-3 max-w-sm font-display text-sm italic leading-relaxed text-white/75">
              La psychologie, toute la psychologie.
            </p>
          </div>
          <ul className="space-y-1.5 text-xs text-white/70">
            <li>Conformité RGPD — vos données vous appartiennent</li>
            <li>Accessibilité RGAA 4.1</li>
            <li>© 2026 Psychostudy. Tous droits réservés.</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
