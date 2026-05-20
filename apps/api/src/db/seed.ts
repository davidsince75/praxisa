/* eslint-disable no-console */
/**
 * Demo seed script — populates the database with realistic data for client demos.
 *
 * Three portals:
 *   Admin     → admin@praxisa.fr       / Admin1234!
 *   Teacher   → prof.martin@praxisa.fr / Teacher1234!
 *             → prof.leblanc@praxisa.fr / Teacher1234!
 *   Student   → marie.dupont@praxisa.fr / Student1234!  (+ 14 more students)
 *
 * Three courses, each with 2–3 modules, varied lesson types, quizzes, and enrolments.
 *
 * Usage: pnpm --filter @praxisa/api db:seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import {
  users,
  courses,
  courseModules,
  lessons,
  exercises,
  quizQuestions,
  enrolments,
  lessonProgress,
} from "./schema/index.js";

// ── DB connection ─────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const db = drizzle(pool);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: "admin" | "instructor" | "student" | "migration_lead";
}) {
  const passwordHash = await hash(data.password);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (existing[0] !== undefined) return existing[0].id;
  const rows = await db
    .insert(users)
    .values({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      role: data.role,
      isActive: true,
      emailVerified: true,
    })
    .returning({ id: users.id });
  const row = rows[0];
  if (row === undefined) throw new Error("upsertUser: insert returned no row");
  return row.id;
}

async function upsertCourse(data: {
  slug: string;
  title: string;
  description: string;
  instructorId: string;
  thumbnailUrl: string;
}) {
  const existing = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, data.slug))
    .limit(1);
  if (existing[0] !== undefined) return existing[0].id;
  const rows = await db
    .insert(courses)
    .values({
      ...data,
      status: "published",
      language: "fr",
      publishedAt: new Date(),
    })
    .returning({ id: courses.id });
  const row = rows[0];
  if (row === undefined)
    throw new Error("upsertCourse: insert returned no row");
  return row.id;
}

async function insertModule(
  courseId: string,
  title: string,
  description: string,
  position: number,
) {
  const rows = await db
    .insert(courseModules)
    .values({ courseId, title, description, position })
    .returning({ id: courseModules.id });
  const row = rows[0];
  if (row === undefined)
    throw new Error("insertModule: insert returned no row");
  return row.id;
}

async function insertLesson(data: {
  moduleId: string;
  title: string;
  description?: string;
  position: number;
  contentType: "video" | "text" | "pdf" | "audio" | "live";
  contentUrl?: string;
  contentBody?: string;
  durationMinutes?: number;
  isFreePreview?: boolean;
}) {
  const rows = await db
    .insert(lessons)
    .values({
      moduleId: data.moduleId,
      title: data.title,
      description: data.description,
      position: data.position,
      contentType: data.contentType,
      contentUrl: data.contentUrl,
      contentBody: data.contentBody,
      durationMinutes: data.durationMinutes ?? 10,
      isFreePreview: data.isFreePreview ?? false,
    })
    .returning({ id: lessons.id });
  const row = rows[0];
  if (row === undefined)
    throw new Error("insertLesson: insert returned no row");
  return row.id;
}

async function insertExercise(
  lessonId: string,
  title: string,
  type: "quiz" | "assignment" | "reflection",
  position: number,
  maxScore: number,
) {
  const rows = await db
    .insert(exercises)
    .values({ lessonId, title, type, position, maxScore, isRequired: true })
    .returning({ id: exercises.id });
  const row = rows[0];
  if (row === undefined)
    throw new Error("insertExercise: insert returned no row");
  return row.id;
}

async function insertQuizQuestions(
  exerciseId: string,
  questions: {
    questionText: string;
    options: { id: string; text: string }[];
    correctOptionId: string;
    explanation: string;
  }[],
) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q === undefined) continue;
    await db.insert(quizQuestions).values({
      exerciseId,
      position: i,
      questionText: q.questionText,
      options: JSON.stringify(q.options),
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
    });
  }
}

async function enrol(studentId: string, courseId: string, enrolledBy: string) {
  const rows = await db
    .insert(enrolments)
    .values({ studentId, courseId, enrolledBy, status: "active" })
    .onConflictDoNothing()
    .returning({ id: enrolments.id });
  return rows[0]?.id;
}

async function markProgress(
  enrolmentId: string,
  lessonId: string,
  status: "not_started" | "in_progress" | "completed",
) {
  await db
    .insert(lessonProgress)
    .values({
      enrolmentId,
      lessonId,
      status,
      startedAt: status !== "not_started" ? new Date() : null,
      completedAt: status === "completed" ? new Date() : null,
      timeSpentSeconds:
        status === "completed" ? Math.floor(Math.random() * 600) + 120 : 0,
    })
    .onConflictDoNothing();
}

// ── Seed data ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding demo data...");

  // ── Users ─────────────────────────────────────────────────────────────────

  console.log("  Creating users...");

  const adminId = await upsertUser({
    email: "admin@praxisa.fr",
    firstName: "Sophie",
    lastName: "Bernard",
    password: "Admin1234!",
    role: "admin",
  });

  const martinId = await upsertUser({
    email: "prof.martin@praxisa.fr",
    firstName: "Julien",
    lastName: "Martin",
    password: "Teacher1234!",
    role: "instructor",
  });

  const leblancId = await upsertUser({
    email: "prof.leblanc@praxisa.fr",
    firstName: "Claire",
    lastName: "Leblanc",
    password: "Teacher1234!",
    role: "instructor",
  });

  const studentData = [
    {
      firstName: "Marie",
      lastName: "Dupont",
      email: "marie.dupont@praxisa.fr",
    },
    {
      firstName: "Thomas",
      lastName: "Moreau",
      email: "thomas.moreau@praxisa.fr",
    },
    { firstName: "Léa", lastName: "Petit", email: "lea.petit@praxisa.fr" },
    { firstName: "Hugo", lastName: "Durand", email: "hugo.durand@praxisa.fr" },
    { firstName: "Emma", lastName: "Leroy", email: "emma.leroy@praxisa.fr" },
    { firstName: "Lucas", lastName: "Simon", email: "lucas.simon@praxisa.fr" },
    {
      firstName: "Chloé",
      lastName: "Michel",
      email: "chloe.michel@praxisa.fr",
    },
    {
      firstName: "Nathan",
      lastName: "Laurent",
      email: "nathan.laurent@praxisa.fr",
    },
    {
      firstName: "Inès",
      lastName: "Lefebvre",
      email: "ines.lefebvre@praxisa.fr",
    },
    { firstName: "Maxime", lastName: "Roux", email: "maxime.roux@praxisa.fr" },
    {
      firstName: "Camille",
      lastName: "David",
      email: "camille.david@praxisa.fr",
    },
    {
      firstName: "Antoine",
      lastName: "Bertrand",
      email: "antoine.bertrand@praxisa.fr",
    },
    {
      firstName: "Juliette",
      lastName: "Morel",
      email: "juliette.morel@praxisa.fr",
    },
    {
      firstName: "Raphaël",
      lastName: "Fournier",
      email: "raphael.fournier@praxisa.fr",
    },
    {
      firstName: "Océane",
      lastName: "Girard",
      email: "oceane.girard@praxisa.fr",
    },
  ];

  const studentIds: string[] = [];
  for (const s of studentData) {
    const id = await upsertUser({
      ...s,
      password: "Student1234!",
      role: "student",
    });
    studentIds.push(id);
  }

  console.log(`  ✓ ${String(studentIds.length + 3)} users created`);

  // ── Course 1: Marketing Digital ───────────────────────────────────────────

  console.log("  Building course 1: Marketing Digital...");

  const course1Id = await upsertCourse({
    slug: "fondamentaux-marketing-digital",
    title: "Fondamentaux du Marketing Digital",
    description:
      "Maîtrisez les bases du marketing digital : SEO, réseaux sociaux, publicité en ligne et analytique web. Une formation complète pour développer votre présence numérique.",
    instructorId: martinId,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
  });

  // Module 1
  const c1m1 = await insertModule(
    course1Id,
    "Introduction au Marketing Digital",
    "Les fondements et l'écosystème digital",
    0,
  );
  const c1m1l1 = await insertLesson({
    moduleId: c1m1,
    title: "Qu'est-ce que le marketing digital ?",
    position: 0,
    contentType: "text",
    isFreePreview: true,
    durationMinutes: 8,
    contentBody: `<h2>Le marketing digital : définition et enjeux</h2>
<p>Le marketing digital désigne l'ensemble des techniques marketing utilisées sur les supports et canaux digitaux pour promouvoir des produits et services auprès des consommateurs.</p>
<h3>Pourquoi le marketing digital est-il essentiel ?</h3>
<ul>
  <li><strong>Portée mondiale</strong> : Toucher des audiences à l'échelle internationale</li>
  <li><strong>Coût maîtrisé</strong> : Des budgets adaptables à toutes les tailles d'entreprise</li>
  <li><strong>Mesurabilité</strong> : Des résultats trackables en temps réel</li>
  <li><strong>Personnalisation</strong> : Des messages ciblés selon les profils</li>
</ul>
<h3>Les 5 piliers du marketing digital</h3>
<ol>
  <li>Le référencement naturel (SEO)</li>
  <li>La publicité payante (SEA / Social Ads)</li>
  <li>Les réseaux sociaux (Social Media Marketing)</li>
  <li>L'email marketing</li>
  <li>Le content marketing</li>
</ol>
<p>Dans cette formation, nous explorerons chacun de ces piliers avec des exemples concrets et des exercices pratiques.</p>`,
  });

  const c1m1l2 = await insertLesson({
    moduleId: c1m1,
    title: "L'écosystème digital en 2024",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 12,
  });

  const c1m1l3 = await insertLesson({
    moduleId: c1m1,
    title: "Quiz — Les bases du marketing digital",
    position: 2,
    contentType: "text",
    durationMinutes: 5,
  });
  const c1m1e1 = await insertExercise(c1m1l3, "Quiz introductif", "quiz", 0, 4);
  await insertQuizQuestions(c1m1e1, [
    {
      questionText:
        "Quel est le principal avantage du marketing digital par rapport au marketing traditionnel ?",
      options: [
        { id: "a", text: "Il est toujours moins cher" },
        { id: "b", text: "Il permet une mesure précise des résultats" },
        { id: "c", text: "Il ne nécessite aucune compétence technique" },
        { id: "d", text: "Il garantit des ventes immédiates" },
      ],
      correctOptionId: "b",
      explanation:
        "La mesurabilité est l'un des atouts majeurs du digital : chaque action peut être tracée et analysée en temps réel.",
    },
    {
      questionText: "Que signifie l'acronyme SEO ?",
      options: [
        { id: "a", text: "Social Engagement Optimization" },
        { id: "b", text: "Search Engine Optimization" },
        { id: "c", text: "Sales Enhancement Operation" },
        { id: "d", text: "Secure Email Output" },
      ],
      correctOptionId: "b",
      explanation:
        "SEO (Search Engine Optimization) désigne l'ensemble des techniques visant à améliorer le positionnement d'un site dans les résultats des moteurs de recherche.",
    },
    {
      questionText:
        "Parmi les canaux suivants, lequel appartient au marketing digital ?",
      options: [
        { id: "a", text: "Affichage publicitaire en ville" },
        { id: "b", text: "Spot radio" },
        { id: "c", text: "Campagne Instagram Ads" },
        { id: "d", text: "Encart dans un magazine" },
      ],
      correctOptionId: "c",
      explanation:
        "Instagram Ads est une plateforme publicitaire digitale. Les autres options sont des canaux de marketing traditionnel.",
    },
    {
      questionText:
        "Quel outil est le plus utilisé pour mesurer le trafic d'un site web ?",
      options: [
        { id: "a", text: "Microsoft Excel" },
        { id: "b", text: "Google Analytics" },
        { id: "c", text: "Adobe Photoshop" },
        { id: "d", text: "Slack" },
      ],
      correctOptionId: "b",
      explanation:
        "Google Analytics est l'outil de mesure d'audience web le plus répandu, permettant de suivre les visites, sources de trafic et comportements des utilisateurs.",
    },
  ]);

  // Module 2
  const c1m2 = await insertModule(
    course1Id,
    "SEO — Référencement Naturel",
    "Optimiser sa visibilité sur les moteurs de recherche",
    1,
  );
  const c1m2l1 = await insertLesson({
    moduleId: c1m2,
    title: "Les fondamentaux du SEO",
    position: 0,
    contentType: "text",
    durationMinutes: 15,
    contentBody: `<h2>Comment fonctionne un moteur de recherche ?</h2>
<p>Les moteurs de recherche comme Google utilisent des robots (crawlers) pour explorer, indexer et classer les pages web. Comprendre ce processus est essentiel pour optimiser son référencement.</p>
<h3>Les 3 piliers du SEO</h3>
<h4>1. Technique</h4>
<p>Vitesse de chargement, structure des URLs, balises meta, données structurées, compatibilité mobile...</p>
<h4>2. Contenu</h4>
<p>Qualité et pertinence des textes, densité des mots-clés, richesse sémantique, fraîcheur du contenu...</p>
<h4>3. Autorité (netlinking)</h4>
<p>Nombre et qualité des liens entrants (backlinks), citations de marque, présence sur les annuaires...</p>
<h3>Les balises indispensables</h3>
<pre><code>&lt;title&gt;Titre de la page (50-60 caractères)&lt;/title&gt;
&lt;meta name="description" content="Description (150-160 caractères)"&gt;
&lt;h1&gt;Titre principal unique par page&lt;/h1&gt;</code></pre>`,
  });

  const c1m2l2 = await insertLesson({
    moduleId: c1m2,
    title: "Guide pratique SEO 2024",
    position: 1,
    contentType: "pdf",
    contentUrl:
      "https://web.dev/static/articles/vitals/image/core-web-vitals-overview.pdf",
    durationMinutes: 20,
  });

  const c1m2l3 = await insertLesson({
    moduleId: c1m2,
    title: "Quiz SEO",
    position: 2,
    contentType: "text",
    durationMinutes: 5,
  });
  const c1m2e1 = await insertExercise(c1m2l3, "Quiz SEO", "quiz", 0, 3);
  await insertQuizQuestions(c1m2e1, [
    {
      questionText:
        "Quel est le nombre idéal de mots-clés principaux à cibler par page ?",
      options: [
        { id: "a", text: "1 mot-clé principal" },
        { id: "b", text: "5 à 10 mots-clés" },
        { id: "c", text: "20 mots-clés minimum" },
        { id: "d", text: "Autant que possible" },
      ],
      correctOptionId: "a",
      explanation:
        "Chaque page doit cibler un mot-clé principal pour éviter la cannibalisation et permettre aux moteurs de recherche de comprendre clairement le sujet.",
    },
    {
      questionText: "Que signifie un backlink de qualité ?",
      options: [
        {
          id: "a",
          text: "Un lien provenant d'un site avec beaucoup de publicités",
        },
        {
          id: "b",
          text: "Un lien provenant d'un site autoritaire et thématiquement cohérent",
        },
        { id: "c", text: "Un lien payant sur n'importe quel site" },
        { id: "d", text: "Un lien en rouge sur la page" },
      ],
      correctOptionId: "b",
      explanation:
        "La qualité d'un backlink dépend de l'autorité du site source et de sa pertinence thématique par rapport à votre contenu.",
    },
    {
      questionText: "Core Web Vitals mesure principalement :",
      options: [
        { id: "a", text: "Le nombre de mots sur une page" },
        {
          id: "b",
          text: "L'expérience utilisateur (vitesse, stabilité visuelle, interactivité)",
        },
        { id: "c", text: "Le nombre de backlinks" },
        { id: "d", text: "La longueur du nom de domaine" },
      ],
      correctOptionId: "b",
      explanation:
        "Core Web Vitals est un ensemble de métriques Google évaluant l'expérience utilisateur réelle : LCP (chargement), FID (interactivité) et CLS (stabilité).",
    },
  ]);

  // Module 3
  const c1m3 = await insertModule(
    course1Id,
    "Réseaux Sociaux & Publicité",
    "Créer et piloter des campagnes performantes",
    2,
  );
  const c1m3l1 = await insertLesson({
    moduleId: c1m3,
    title: "Stratégie réseaux sociaux",
    position: 0,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/wnOhqDCagUw",
    durationMinutes: 18,
  });
  const c1m3l2 = await insertLesson({
    moduleId: c1m3,
    title: "Créer sa première campagne Meta Ads",
    position: 1,
    contentType: "text",
    durationMinutes: 20,
    contentBody: `<h2>Lancer une campagne publicitaire sur Meta (Facebook & Instagram)</h2>
<p>Meta Ads Manager est la plateforme centralisée pour créer et gérer des publicités sur Facebook et Instagram. Voici les étapes clés.</p>
<h3>Structure d'une campagne Meta</h3>
<p>Une campagne est organisée en 3 niveaux :</p>
<ul>
  <li><strong>Campagne</strong> : Objectif marketing (notoriété, trafic, conversions…)</li>
  <li><strong>Ensemble d'annonces</strong> : Audience, budget, calendrier, placements</li>
  <li><strong>Annonce</strong> : Visuels, textes, appel à l'action</li>
</ul>
<h3>Choisir le bon objectif</h3>
<table>
  <tr><th>Objectif</th><th>Quand l'utiliser</th></tr>
  <tr><td>Notoriété</td><td>Lancer une nouvelle marque</td></tr>
  <tr><td>Trafic</td><td>Amener des visiteurs sur votre site</td></tr>
  <tr><td>Leads</td><td>Collecter des contacts qualifiés</td></tr>
  <tr><td>Ventes</td><td>E-commerce avec catalogue produit</td></tr>
</table>
<h3>Ciblage : la clé du succès</h3>
<p>Meta propose trois types d'audiences :</p>
<ol>
  <li><strong>Audiences principales</strong> : Démographie, intérêts, comportements</li>
  <li><strong>Audiences personnalisées</strong> : Vos clients existants, visiteurs du site</li>
  <li><strong>Audiences similaires (Lookalike)</strong> : Profils ressemblant à vos meilleurs clients</li>
</ol>`,
  });

  console.log("  ✓ Course 1 built");

  // ── Course 2: Excel Professionnel ─────────────────────────────────────────

  console.log("  Building course 2: Excel Professionnel...");

  const course2Id = await upsertCourse({
    slug: "excel-pour-les-professionnels",
    title: "Excel pour les Professionnels",
    description:
      "De la feuille de calcul simple aux tableaux de bord avancés. Maîtrisez Excel pour gagner en productivité et prendre de meilleures décisions grâce aux données.",
    instructorId: leblancId,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
  });

  const c2m1 = await insertModule(
    course2Id,
    "Les Bases d'Excel",
    "Navigation, formules essentielles et mise en forme",
    0,
  );
  const c2m1l1 = await insertLesson({
    moduleId: c2m1,
    title: "Interface et navigation",
    position: 0,
    contentType: "text",
    isFreePreview: true,
    durationMinutes: 10,
    contentBody: `<h2>Découvrir l'interface Excel</h2>
<p>Excel est organisé autour de quelques zones clés que vous devez maîtriser pour travailler efficacement.</p>
<h3>Les éléments principaux</h3>
<ul>
  <li><strong>Le ruban</strong> : La barre d'outils en haut avec tous les menus (Accueil, Insertion, Formules…)</li>
  <li><strong>La barre de formule</strong> : Affiche le contenu de la cellule sélectionnée</li>
  <li><strong>La zone de nom</strong> : Indique la référence de la cellule active (ex: A1)</li>
  <li><strong>Les onglets de feuilles</strong> : En bas, pour naviguer entre les feuilles</li>
</ul>
<h3>Raccourcis indispensables</h3>
<table>
  <tr><th>Raccourci</th><th>Action</th></tr>
  <tr><td>Ctrl + Z</td><td>Annuler</td></tr>
  <tr><td>Ctrl + C / V</td><td>Copier / Coller</td></tr>
  <tr><td>Ctrl + Flèche</td><td>Aller au dernier élément du bloc</td></tr>
  <tr><td>Ctrl + Maj + Fin</td><td>Sélectionner jusqu'à la dernière cellule utilisée</td></tr>
  <tr><td>F2</td><td>Éditer la cellule active</td></tr>
  <tr><td>Alt + =</td><td>Insérer une somme automatique</td></tr>
</table>`,
  });

  const c2m1l2 = await insertLesson({
    moduleId: c2m1,
    title: "Les formules essentielles",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/rwbho0CgEAE",
    durationMinutes: 22,
  });

  const c2m1l3 = await insertLesson({
    moduleId: c2m1,
    title: "Quiz — Bases Excel",
    position: 2,
    contentType: "text",
    durationMinutes: 5,
  });
  const c2m1e1 = await insertExercise(c2m1l3, "Quiz bases Excel", "quiz", 0, 3);
  await insertQuizQuestions(c2m1e1, [
    {
      questionText: "Quelle formule permet de calculer la somme de A1 à A10 ?",
      options: [
        { id: "a", text: "=TOTAL(A1:A10)" },
        { id: "b", text: "=SOMME(A1:A10)" },
        { id: "c", text: "=ADDITION(A1,A10)" },
        { id: "d", text: "=PLUS(A1:A10)" },
      ],
      correctOptionId: "b",
      explanation:
        "La fonction SOMME est la fonction de base pour additionner une plage de cellules. La syntaxe est =SOMME(plage).",
    },
    {
      questionText:
        "Comment figer la ligne 1 pour qu'elle reste visible lors du défilement ?",
      options: [
        { id: "a", text: "Format > Cellules > Figer" },
        {
          id: "b",
          text: "Affichage > Figer les volets > Figer la ligne supérieure",
        },
        { id: "c", text: "Insertion > Figer > Ligne 1" },
        { id: "d", text: "Ctrl + F1" },
      ],
      correctOptionId: "b",
      explanation:
        "Dans l'onglet Affichage, 'Figer les volets' propose plusieurs options : figer la ligne supérieure, la première colonne ou une zone personnalisée.",
    },
    {
      questionText: "Qu'est-ce qu'une référence absolue en Excel ?",
      options: [
        { id: "a", text: "Une cellule dont la valeur ne peut pas changer" },
        {
          id: "b",
          text: "Une référence qui ne change pas lors de la copie de la formule (ex: $A$1)",
        },
        { id: "c", text: "Une formule sans erreur" },
        { id: "d", text: "Une cellule verrouillée par un mot de passe" },
      ],
      correctOptionId: "b",
      explanation:
        "Le symbole $ devant la lettre et/ou le chiffre fige la référence lors de la copie : $A$1 est totalement fixe, $A1 fige seulement la colonne.",
    },
  ]);

  const c2m2 = await insertModule(
    course2Id,
    "Tableaux Croisés Dynamiques",
    "Analyser et synthétiser vos données en quelques clics",
    1,
  );
  const c2m2l1 = await insertLesson({
    moduleId: c2m2,
    title: "Créer son premier TCD",
    position: 0,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/9NUjHBNWe9M",
    durationMinutes: 25,
  });
  const c2m2l2 = await insertLesson({
    moduleId: c2m2,
    title: "Manuel — Tableaux croisés dynamiques",
    position: 1,
    contentType: "pdf",
    contentUrl:
      "https://download.microsoft.com/download/1/4/E/14EDED28-AF29-40B7-8523-B6F19FD80B94/Excel_Basics_en.pdf",
    durationMinutes: 30,
  });

  const c2m3 = await insertModule(
    course2Id,
    "Tableaux de Bord et Visualisation",
    "Créer des dashboards percutants",
    2,
  );
  const c2m3l1 = await insertLesson({
    moduleId: c2m3,
    title: "Graphiques et visualisation de données",
    position: 0,
    contentType: "text",
    durationMinutes: 18,
    contentBody: `<h2>Choisir le bon type de graphique</h2>
<p>Un bon graphique raconte une histoire. Le choix du type dépend de ce que vous voulez montrer.</p>
<h3>Guide de sélection</h3>
<table>
  <tr><th>Objectif</th><th>Type recommandé</th></tr>
  <tr><td>Comparer des valeurs</td><td>Histogramme / Barres</td></tr>
  <tr><td>Évolution dans le temps</td><td>Courbe (ligne)</td></tr>
  <tr><td>Proportion du tout</td><td>Secteurs (camembert)</td></tr>
  <tr><td>Corrélation entre 2 variables</td><td>Nuage de points</td></tr>
  <tr><td>Hiérarchie / Structure</td><td>Arborescence / Treemap</td></tr>
</table>
<h3>Les 5 règles d'un bon graphique</h3>
<ol>
  <li>Un seul message principal par graphique</li>
  <li>Titre explicite et autonome</li>
  <li>Légende claire et minimale</li>
  <li>Pas de déformations d'échelle</li>
  <li>Cohérence des couleurs avec votre charte</li>
</ol>`,
  });

  const c2m3l2 = await insertLesson({
    moduleId: c2m3,
    title: "Quiz final — Excel",
    position: 1,
    contentType: "text",
    durationMinutes: 8,
  });
  const c2m3e1 = await insertExercise(c2m3l2, "Quiz final Excel", "quiz", 0, 3);
  await insertQuizQuestions(c2m3e1, [
    {
      questionText: "Dans un TCD, que permet le champ 'Valeurs' ?",
      options: [
        { id: "a", text: "Filtrer les données affichées" },
        {
          id: "b",
          text: "Calculer des agrégats (somme, moyenne, comptage…) sur les données",
        },
        { id: "c", text: "Trier les lignes alphabétiquement" },
        { id: "d", text: "Définir le titre du tableau" },
      ],
      correctOptionId: "b",
      explanation:
        "Le champ Valeurs est le cœur du TCD : il applique une fonction d'agrégation (SOMME par défaut) aux données numériques.",
    },
    {
      questionText:
        "Quel type de graphique est le plus adapté pour montrer l'évolution du CA mensuel sur 12 mois ?",
      options: [
        { id: "a", text: "Graphique en secteurs (camembert)" },
        { id: "b", text: "Nuage de points" },
        { id: "c", text: "Graphique en courbes" },
        { id: "d", text: "Graphique radar" },
      ],
      correctOptionId: "c",
      explanation:
        "Le graphique en courbes est idéal pour visualiser des tendances et évolutions dans le temps.",
    },
    {
      questionText: 'La formule =NB.SI(A1:A100,"Paris") compte :',
      options: [
        { id: "a", text: "La somme des valeurs contenant 'Paris'" },
        { id: "b", text: "Le nombre de cellules contenant exactement 'Paris'" },
        { id: "c", text: "La position de la première occurrence de 'Paris'" },
        { id: "d", text: "Le pourcentage de cellules contenant 'Paris'" },
      ],
      correctOptionId: "b",
      explanation:
        "NB.SI compte le nombre de cellules dans une plage qui satisfont un critère donné. Ici, elle compte les cellules contenant exactement 'Paris'.",
    },
  ]);

  console.log("  ✓ Course 2 built");

  // ── Course 3: Communication Professionnelle ───────────────────────────────

  console.log("  Building course 3: Communication Professionnelle...");

  const course3Id = await upsertCourse({
    slug: "communication-professionnelle",
    title: "Communication Professionnelle",
    description:
      "Développez vos compétences en communication écrite et orale. E-mails impactants, présentations convaincantes, réunions efficaces : les clés pour vous démarquer en entreprise.",
    instructorId: martinId,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
  });

  const c3m1 = await insertModule(
    course3Id,
    "Communication Écrite",
    "E-mails, rapports et supports professionnels",
    0,
  );
  const c3m1l1 = await insertLesson({
    moduleId: c3m1,
    title: "L'e-mail professionnel parfait",
    position: 0,
    contentType: "text",
    isFreePreview: true,
    durationMinutes: 12,
    contentBody: `<h2>Écrire des e-mails professionnels efficaces</h2>
<p>Un e-mail professionnel est souvent le premier contact avec un interlocuteur. Son impact sur votre image est immédiat.</p>
<h3>Structure d'un e-mail professionnel</h3>
<ol>
  <li><strong>Objet</strong> : Précis, court, orienté action (max 50 caractères)</li>
  <li><strong>Formule d'appel</strong> : Madame, Monsieur / Bonjour + prénom (selon le contexte)</li>
  <li><strong>Corps</strong> : Contexte → Demande/Information → Action attendue</li>
  <li><strong>Formule de politesse</strong> : Adaptée au niveau de formalité</li>
  <li><strong>Signature</strong> : Nom, poste, contact, logo</li>
</ol>
<h3>Exemple : e-mail de suivi client</h3>
<blockquote>
<p><strong>Objet :</strong> Suivi de votre devis n°2024-087 — Praxisa Formation</p>
<p>Madame Moreau,</p>
<p>Suite à notre échange du 15 novembre, je me permets de revenir vers vous concernant le devis que nous vous avons adressé pour la formation Excel Avancé (référence 2024-087).</p>
<p>Avez-vous pu étudier notre proposition ? Je suis disponible pour échanger par téléphone si vous avez des questions ou souhaitez ajuster le programme.</p>
<p>Dans l'attente de votre retour, je reste à votre disposition.</p>
<p>Cordialement,<br>Julien Martin<br>Responsable formation — Praxisa</p>
</blockquote>
<h3>Les erreurs à éviter</h3>
<ul>
  <li>❌ Objet vague ("Question", "Important", "Re: Re: Re:")</li>
  <li>❌ Paragraphes trop longs (plus de 5 lignes)</li>
  <li>❌ Ton trop familier ou trop guindé selon le contexte</li>
  <li>❌ Pièces jointes non mentionnées dans le corps</li>
  <li>❌ Oublier de relire avant d'envoyer</li>
</ul>`,
  });

  const c3m1l2 = await insertLesson({
    moduleId: c3m1,
    title: "Guide de la communication écrite",
    position: 1,
    contentType: "pdf",
    contentUrl:
      "https://www.gouvernement.fr/sites/default/files/contenu/piece-jointe/2015/01/guide_redaction_administrative_2015.pdf",
    durationMinutes: 25,
  });

  const c3m1l3 = await insertLesson({
    moduleId: c3m1,
    title: "Quiz — Communication écrite",
    position: 2,
    contentType: "text",
    durationMinutes: 5,
  });
  const c3m1e1 = await insertExercise(
    c3m1l3,
    "Quiz communication écrite",
    "quiz",
    0,
    3,
  );
  await insertQuizQuestions(c3m1e1, [
    {
      questionText:
        "Quelle est la longueur idéale pour l'objet d'un e-mail professionnel ?",
      options: [
        { id: "a", text: "Moins de 10 caractères" },
        { id: "b", text: "Entre 40 et 50 caractères" },
        { id: "c", text: "Plus de 100 caractères pour être précis" },
        { id: "d", text: "La longueur n'a pas d'importance" },
      ],
      correctOptionId: "b",
      explanation:
        "Un objet de 40-50 caractères est optimal : assez précis pour informer le destinataire, assez court pour être lu entièrement dans la boîte de réception.",
    },
    {
      questionText:
        "Dans quel cas utilise-t-on 'Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées' ?",
      options: [
        { id: "a", text: "Dans tous les e-mails professionnels" },
        {
          id: "b",
          text: "Uniquement dans les courriers formels à des inconnus ou des administrations",
        },
        { id: "c", text: "Entre collègues du même service" },
        { id: "d", text: "Jamais, cette formule est obsolète" },
      ],
      correctOptionId: "b",
      explanation:
        "Cette formule très formelle est réservée aux courriers officiels. Entre professionnels qui se connaissent, 'Cordialement' ou 'Bien à vous' suffisent.",
    },
    {
      questionText:
        "Vous devez envoyer un document urgent à un client. Quelle est la bonne pratique ?",
      options: [
        { id: "a", text: "Envoyer le document sans texte dans le corps" },
        {
          id: "b",
          text: "Mentionner la pièce jointe dans le corps ET vérifier qu'elle est bien attachée avant d'envoyer",
        },
        {
          id: "c",
          text: "Mettre 'URGENT' en majuscules dans l'objet et le corps",
        },
        {
          id: "d",
          text: "Envoyer depuis son adresse personnelle pour plus de rapidité",
        },
      ],
      correctOptionId: "b",
      explanation:
        "Toujours mentionner les pièces jointes dans le corps de l'e-mail, et vérifier leur présence avant l'envoi. Les majuscules dans l'objet sont à proscrire.",
    },
  ]);

  const c3m2 = await insertModule(
    course3Id,
    "Communication Orale",
    "Prises de parole, réunions et présentations",
    1,
  );
  const c3m2l1 = await insertLesson({
    moduleId: c3m2,
    title: "Maîtriser sa prise de parole en public",
    position: 0,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/tShavGuo0_E",
    durationMinutes: 20,
  });
  const c3m2l2 = await insertLesson({
    moduleId: c3m2,
    title: "Animer une réunion efficace",
    position: 1,
    contentType: "text",
    durationMinutes: 15,
    contentBody: `<h2>Les réunions inefficaces coûtent cher</h2>
<p>En France, un cadre passe en moyenne 4h30 en réunion par semaine. Une réunion mal animée est une perte sèche de productivité pour toute l'équipe.</p>
<h3>Avant la réunion : la préparation</h3>
<ul>
  <li>Définir un objectif précis et mesurable</li>
  <li>N'inviter que les personnes indispensables</li>
  <li>Envoyer l'ordre du jour 24h à l'avance</li>
  <li>Préparer les documents supports</li>
</ul>
<h3>Pendant la réunion : l'animation</h3>
<ul>
  <li><strong>Démarrer à l'heure</strong> — ne pas récompenser les retardataires</li>
  <li><strong>Rappeler l'objectif</strong> en introduction (1 minute)</li>
  <li><strong>Timeboxer les points</strong> — allouer un temps par sujet</li>
  <li><strong>Gérer la parole</strong> — distribuer, recadrer, synthétiser</li>
  <li><strong>Prendre des décisions</strong> — ne pas repartir sans conclusion</li>
</ul>
<h3>Après la réunion : le suivi</h3>
<p>Envoyer le compte-rendu dans les 24h avec : décisions prises, actions à mener, responsables, échéances.</p>`,
  });

  const c3m3 = await insertModule(
    course3Id,
    "Communication Interculturelle",
    "Travailler efficacement dans un contexte international",
    2,
  );
  const c3m3l1 = await insertLesson({
    moduleId: c3m3,
    title: "Les dimensions culturelles selon Hofstede",
    position: 0,
    contentType: "text",
    durationMinutes: 18,
    contentBody: `<h2>Comprendre les différences culturelles en entreprise</h2>
<p>Geert Hofstede a identifié 6 dimensions culturelles qui expliquent les différences de comportement en milieu professionnel entre les pays.</p>
<h3>Les 6 dimensions de Hofstede</h3>
<ol>
  <li><strong>Distance hiérarchique</strong> : Degré d'acceptation des inégalités de pouvoir</li>
  <li><strong>Individualisme vs Collectivisme</strong> : Priorité à l'individu ou au groupe</li>
  <li><strong>Masculinité vs Féminité</strong> : Compétition vs coopération</li>
  <li><strong>Contrôle de l'incertitude</strong> : Tolérance à l'ambiguïté</li>
  <li><strong>Orientation long terme vs court terme</strong></li>
  <li><strong>Indulgence vs Retenue</strong></li>
</ol>
<h3>Exemple pratique : France vs Japon</h3>
<table>
  <tr><th>Dimension</th><th>France</th><th>Japon</th></tr>
  <tr><td>Distance hiérarchique</td><td>68 (élevée)</td><td>54 (moyenne)</td></tr>
  <tr><td>Individualisme</td><td>71 (fort)</td><td>46 (moyen)</td></tr>
  <tr><td>Masculinité</td><td>43 (féminin)</td><td>95 (très masculin)</td></tr>
</table>`,
  });

  const c3m3l2 = await insertLesson({
    moduleId: c3m3,
    title: "Quiz final — Communication",
    position: 1,
    contentType: "text",
    durationMinutes: 6,
  });
  const c3m3e1 = await insertExercise(
    c3m3l2,
    "Quiz final communication",
    "quiz",
    0,
    2,
  );
  await insertQuizQuestions(c3m3e1, [
    {
      questionText:
        "Dans une culture à forte distance hiérarchique, comment les décisions sont-elles généralement prises ?",
      options: [
        { id: "a", text: "Par vote démocratique de l'équipe" },
        { id: "b", text: "Par le supérieur hiérarchique, sans consultation" },
        { id: "c", text: "Par consensus de tous les membres" },
        { id: "d", text: "Par le membre le plus ancien" },
      ],
      correctOptionId: "b",
      explanation:
        "Dans les cultures à forte distance hiérarchique (ex: France, Chine), le pouvoir est concentré et les décisions viennent d'en haut.",
    },
    {
      questionText:
        "Un collègue japonais dit 'c'est difficile' à votre proposition. Que cela signifie-t-il probablement ?",
      options: [
        { id: "a", text: "Il a besoin d'aide technique" },
        { id: "b", text: "Il souhaite un délai supplémentaire" },
        { id: "c", text: "Il refuse poliment sans dire 'non' directement" },
        { id: "d", text: "Il accepte mais avec des réserves mineures" },
      ],
      correctOptionId: "c",
      explanation:
        "Dans les cultures à communication indirecte (Japon, Corée, etc.), 'c'est difficile' est souvent un refus poli. Dire 'non' directement est considéré comme impoli.",
    },
  ]);

  console.log("  ✓ Course 3 built");

  // ── Enrolments + progress ─────────────────────────────────────────────────

  console.log("  Creating enrolments and progress...");

  // All lesson IDs per course for progress tracking
  const course1Lessons = [
    c1m1l1,
    c1m1l2,
    c1m1l3,
    c1m2l1,
    c1m2l2,
    c1m2l3,
    c1m3l1,
    c1m3l2,
  ];
  const course2Lessons = [
    c2m1l1,
    c2m1l2,
    c2m1l3,
    c2m2l1,
    c2m2l2,
    c2m3l1,
    c2m3l2,
  ];
  const course3Lessons = [
    c3m1l1,
    c3m1l2,
    c3m1l3,
    c3m2l1,
    c3m2l2,
    c3m3l1,
    c3m3l2,
  ];

  // Enrol students in courses with varying completion levels
  const enrolmentConfigs = [
    // Students 0-4: course 1, varying progress
    {
      studentIdx: 0,
      courseId: course1Id,
      lessons: course1Lessons,
      completedCount: 8,
    }, // Marie — completed
    {
      studentIdx: 1,
      courseId: course1Id,
      lessons: course1Lessons,
      completedCount: 5,
    }, // Thomas — halfway
    {
      studentIdx: 2,
      courseId: course1Id,
      lessons: course1Lessons,
      completedCount: 2,
    }, // Léa — just started
    {
      studentIdx: 3,
      courseId: course1Id,
      lessons: course1Lessons,
      completedCount: 0,
    }, // Hugo — enrolled, not started
    {
      studentIdx: 4,
      courseId: course1Id,
      lessons: course1Lessons,
      completedCount: 8,
    }, // Emma — completed

    // Students 5-9: course 2
    {
      studentIdx: 5,
      courseId: course2Id,
      lessons: course2Lessons,
      completedCount: 7,
    }, // Lucas — completed
    {
      studentIdx: 6,
      courseId: course2Id,
      lessons: course2Lessons,
      completedCount: 4,
    }, // Chloé — halfway
    {
      studentIdx: 7,
      courseId: course2Id,
      lessons: course2Lessons,
      completedCount: 1,
    }, // Nathan — started
    {
      studentIdx: 8,
      courseId: course2Id,
      lessons: course2Lessons,
      completedCount: 6,
    }, // Inès — almost done
    {
      studentIdx: 9,
      courseId: course2Id,
      lessons: course2Lessons,
      completedCount: 3,
    }, // Maxime

    // Students 10-14: course 3
    {
      studentIdx: 10,
      courseId: course3Id,
      lessons: course3Lessons,
      completedCount: 7,
    }, // Camille — completed
    {
      studentIdx: 11,
      courseId: course3Id,
      lessons: course3Lessons,
      completedCount: 2,
    }, // Antoine
    {
      studentIdx: 12,
      courseId: course3Id,
      lessons: course3Lessons,
      completedCount: 5,
    }, // Juliette — halfway
    {
      studentIdx: 13,
      courseId: course3Id,
      lessons: course3Lessons,
      completedCount: 0,
    }, // Raphaël — enrolled
    {
      studentIdx: 14,
      courseId: course3Id,
      lessons: course3Lessons,
      completedCount: 4,
    }, // Océane

    // Cross-enrolments: some students in multiple courses
    {
      studentIdx: 0,
      courseId: course2Id,
      lessons: course2Lessons,
      completedCount: 3,
    }, // Marie also in Excel
    {
      studentIdx: 5,
      courseId: course3Id,
      lessons: course3Lessons,
      completedCount: 2,
    }, // Lucas also in Comms
    {
      studentIdx: 10,
      courseId: course1Id,
      lessons: course1Lessons,
      completedCount: 6,
    }, // Camille also in Marketing
  ];

  for (const config of enrolmentConfigs) {
    const studentId = studentIds[config.studentIdx];
    if (studentId === undefined) continue;
    const enrolmentId = await enrol(studentId, config.courseId, adminId);
    if (enrolmentId === undefined) continue;

    for (let i = 0; i < config.lessons.length; i++) {
      const lessonId = config.lessons[i];
      if (lessonId === undefined) continue;
      let status: "not_started" | "in_progress" | "completed" = "not_started";
      if (i < config.completedCount) status = "completed";
      else if (i === config.completedCount) status = "in_progress";
      if (status !== "not_started") {
        await markProgress(enrolmentId, lessonId, status);
      }
    }
  }

  console.log("  ✓ Enrolments and progress seeded");
  console.log("\n✅ Seed complete!\n");
  console.log("Demo accounts:");
  console.log("  Admin    → admin@praxisa.fr       / Admin1234!");
  console.log("  Teacher  → prof.martin@praxisa.fr / Teacher1234!");
  console.log("  Teacher  → prof.leblanc@praxisa.fr / Teacher1234!");
  console.log("  Student  → marie.dupont@praxisa.fr / Student1234!");
  console.log("  (+ 14 more students with Student1234!)\n");
}

seed()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
  });
