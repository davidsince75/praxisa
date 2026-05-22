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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { eq, sql } from "drizzle-orm";
import {
  users,
  courses,
  courseModules,
  lessons,
  exercises,
  quizQuestions,
  enrolments,
  lessonProgress,
  messageThreads,
  messages,
  notifications,
  submissions,
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
  console.log("\u{1F331} Seeding Praxisa clinical psychology demo data...");

  // ── Clean slate ─────────────────────────────────────────────────────────
  console.log("  Clearing existing demo data...");
  await db.execute(
    sql`TRUNCATE notifications, messages, message_threads, quiz_attempts, quiz_questions, exercises, lesson_progress, enrolments, lessons, course_modules, course_ratings, courses, users CASCADE`,
  );

  // ── Users ─────────────────────────────────────────────────────────────────

  console.log("  Creating users...");

  const adminId = await upsertUser({
    email: "admin@praxisa.fr",
    firstName: "Sophie",
    lastName: "Bernard",
    password: "Admin1234!",
    role: "admin",
  });

  const clairembeaudId = await upsertUser({
    email: "prof.martin@praxisa.fr",
    firstName: "Jean-Marc",
    lastName: "Clairembeaud",
    password: "Teacher1234!",
    role: "instructor",
  });

  const leblancId = await upsertUser({
    email: "prof.leblanc@praxisa.fr",
    firstName: "Nathalie",
    lastName: "Dubois-Faure",
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

  // ── Course 1: Psychologie clinique (main program) ────────────────────────

  console.log("  Building course 1: Psychologie clinique...");

  const course1Id = await upsertCourse({
    slug: "psychologie-clinique",
    title: "Psychologie clinique — Formation complète",
    description:
      "Formation fondamentale en psychologie clinique : structures de la personnalité, psychopathologie, analyse du caractère, processus conscients et inconscients. Programme de 480 heures validé Qualiopi, couvrant les 14 unités du cursus de psychopraticien.",
    instructorId: clairembeaudId,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800",
  });

  // Module 1 — U1: Structures de la personnalité
  const c1m1 = await insertModule(
    course1Id,
    "U1 — Structures de la personnalité",
    "Les grandes structures de la personnalité selon les approches psychanalytiques, cognitives et intégratives.",
    0,
  );
  const c1m1l1 = await insertLesson({
    moduleId: c1m1,
    title: "Introduction aux structures de la personnalité",
    position: 0,
    contentType: "text",
    isFreePreview: true,
    durationMinutes: 15,
    contentBody: `<h2>Les structures de la personnalité</h2>
<p>La psychologie clinique distingue traditionnellement trois grandes structures de la personnalité : névrotique, psychotique et état-limite (borderline). Cette classification, héritée des travaux de Jean Bergeret, reste un outil fondamental pour le clinicien.</p>
<h3>Structure névrotique</h3>
<p>Caractérisée par un œdipe structurant, un surmoi bien intériorisé et des mécanismes de défense évolués (refoulement, déplacement, rationalisation). L’angoisse prédominante est l’angoisse de castration.</p>
<h3>Structure psychotique</h3>
<p>Marquée par un défaut de symbolisation, des mécanismes archaïques (déni, clivage du moi, projection) et une angoisse de morcellement. Le rapport à la réalité est altéré.</p>
<h3>États-limites</h3>
<p>Aménagement instable entre les deux structures, avec des mécanismes de clivage de l’objet et une angoisse d’abandon. Le narcissisme est fragile.</p>`,
  });

  const c1m1l2 = await insertLesson({
    moduleId: c1m1,
    title: "Les mécanismes de défense",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 18,
  });

  const c1m1l3 = await insertLesson({
    moduleId: c1m1,
    title: "Quiz — Structures de la personnalité",
    position: 2,
    contentType: "text",
    durationMinutes: 10,
  });
  const c1m1e1 = await insertExercise(
    c1m1l3,
    "Quiz structures de la personnalité",
    "quiz",
    0,
    4,
  );
  await insertQuizQuestions(c1m1e1, [
    {
      questionText:
        "Selon Jean Bergeret, quelle est l’angoisse prédominante dans la structure névrotique ?",
      options: [
        { id: "a", text: "Angoisse de morcellement" },
        { id: "b", text: "Angoisse de castration" },
        { id: "c", text: "Angoisse d’abandon" },
        { id: "d", text: "Angoisse de persécution" },
      ],
      correctOptionId: "b",
      explanation:
        "L’angoisse de castration est spécifique à la structure névrotique, liée au complexe d’Œdipe et à la crainte symbolique de la perte.",
    },
    {
      questionText:
        "Quel mécanisme de défense est typique de la structure psychotique ?",
      options: [
        { id: "a", text: "Le refoulement" },
        { id: "b", text: "La sublimation" },
        { id: "c", text: "Le déni de la réalité" },
        { id: "d", text: "La rationalisation" },
      ],
      correctOptionId: "c",
      explanation:
        "Le déni de la réalité est un mécanisme archaïque caractéristique de la structure psychotique, où le sujet rejette un fragment de la réalité externe.",
    },
    {
      questionText:
        "Quelle est la caractéristique principale de l’aménagement état-limite ?",
      options: [
        { id: "a", text: "Un surmoi rigide" },
        { id: "b", text: "Un narcissisme solide" },
        { id: "c", text: "Un clivage de l’objet" },
        { id: "d", text: "Une symbolisation aboutie" },
      ],
      correctOptionId: "c",
      explanation:
        "Le clivage de l’objet — alternance entre idéalisation et dévalorisation — est le mécanisme central des états-limites.",
    },
    {
      questionText: "Qui a formalisé la nosographie structurale en France ?",
      options: [
        { id: "a", text: "Sigmund Freud" },
        { id: "b", text: "Jacques Lacan" },
        { id: "c", text: "Jean Bergeret" },
        { id: "d", text: "Carl Rogers" },
      ],
      correctOptionId: "c",
      explanation:
        "Jean Bergeret a développé la nosographie structurale française distinguant névrose, psychose et états-limites.",
    },
  ]);

  // Module 2 — U2: Psychopathologie fondamentale
  const c1m2 = await insertModule(
    course1Id,
    "U2 — Psychopathologie fondamentale",
    "Classification et compréhension des troubles psychiques : névroses, psychoses, troubles de l’humeur, troubles anxieux.",
    1,
  );
  const c1m2l1 = await insertLesson({
    moduleId: c1m2,
    title: "Les névroses : hysterie, obsessionnelle, phobique",
    position: 0,
    contentType: "text",
    durationMinutes: 20,
    contentBody: `<h2>Les névroses</h2>
<p>Les névroses constituent un ensemble de troubles psychiques caractérisés par des conflits intrapsychiques inconscients. Le sujet conserve le sens de la réalité mais souffre de symptômes gênants.</p>
<h3>Névrose hystérique (conversion)</h3>
<p>Conversion somatique de conflits psychiques. Symptômes corporels sans substrat organique : paralysies, amnésies, crises pseudo-épileptiques.</p>
<h3>Névrose obsessionnelle (TOC)</h3>
<p>Pensées intrusives récurrentes et rituels compulsifs. Lutte permanente entre désir et interdit, avec des formations réactionnelles et des mécanismes d’isolation.</p>
<h3>Névrose phobique</h3>
<p>Déplacement de l’angoisse sur un objet ou une situation externe. Mécanismes de déplacement et d’évitement. Agoraphobie, claustrophobie, phobies sociales.</p>`,
  });

  const c1m2l2 = await insertLesson({
    moduleId: c1m2,
    title: "Les troubles de l’humeur : dépression et bipolarité",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 22,
  });

  const c1m2l3 = await insertLesson({
    moduleId: c1m2,
    title: "Les psychoses : schizophrénie et paranoïa",
    position: 2,
    contentType: "text",
    durationMinutes: 25,
    contentBody: `<h2>Les psychoses</h2>
<p>Les psychoses sont des troubles sévères où le rapport à la réalité est profondément altéré. Le sujet ne reconnaît pas le caractère pathologique de ses symptômes.</p>
<h3>Schizophrénie</h3>
<p>Dissociation, délires, hallucinations, retrait social. Symptômes positifs (productions délirantes) et négatifs (apathie, alogie).</p>
<h3>Paranoïa</h3>
<p>Délire systématisé, cohérent et inaltérable. Thèmes de persécution, jalousie, érotomanie. Hypertrophie du moi.</p>`,
  });

  const c1m2l4 = await insertLesson({
    moduleId: c1m2,
    title: "Quiz — Psychopathologie",
    position: 3,
    contentType: "text",
    durationMinutes: 8,
  });
  const c1m2e1 = await insertExercise(
    c1m2l4,
    "Quiz psychopathologie",
    "quiz",
    0,
    3,
  );
  await insertQuizQuestions(c1m2e1, [
    {
      questionText:
        "Quel est le mécanisme de défense principal de la névrose phobique ?",
      options: [
        { id: "a", text: "La projection" },
        { id: "b", text: "Le déplacement" },
        { id: "c", text: "L’isolation" },
        { id: "d", text: "Le déni" },
      ],
      correctOptionId: "b",
      explanation:
        "Dans la névrose phobique, l’angoisse est déplacée sur un objet ou une situation externe, permettant au sujet de l’éviter.",
    },
    {
      questionText:
        "Qu’est-ce qui distingue un délire schizophrénique d’un délire paranoïaque ?",
      options: [
        {
          id: "a",
          text: "Le délire schizophrénique est systématisé et cohérent",
        },
        { id: "b", text: "Le délire paranoïaque est polymorphe et incohérent" },
        {
          id: "c",
          text: "Le délire schizophrénique est non systématisé et flou",
        },
        { id: "d", text: "Ils sont identiques" },
      ],
      correctOptionId: "c",
      explanation:
        "Le délire schizophrénique est typiquement non systématisé, polymorphe et flou, tandis que le délire paranoïaque est systématisé et cohérent.",
    },
    {
      questionText:
        "Dans quelle névrose observe-t-on des formations réactionnelles ?",
      options: [
        { id: "a", text: "Névrose hystérique" },
        { id: "b", text: "Névrose phobique" },
        { id: "c", text: "Névrose obsessionnelle" },
        { id: "d", text: "Névrose d’angoisse" },
      ],
      correctOptionId: "c",
      explanation:
        "Les formations réactionnelles sont caractéristiques de la névrose obsessionnelle : le sujet adopte des attitudes opposées à ses désirs refoulés.",
    },
  ]);

  // Module 3 — U4: Conscience et inconscient
  const c1m3 = await insertModule(
    course1Id,
    "U4 — Conscience et inconscient",
    "Exploration des niveaux de conscience, du rôle de l’inconscient, et des apports de la psychanalyse freudienne et lacanienne.",
    2,
  );
  const c1m3l1 = await insertLesson({
    moduleId: c1m3,
    title: "La première topique freudienne",
    position: 0,
    contentType: "text",
    durationMinutes: 18,
    contentBody: `<h2>La première topique : Conscient, Préconscient, Inconscient</h2>
<p>Freud a proposé en 1900 son premier modèle de l’appareil psychique, la « première topique », distinguant trois instances :</p>
<h3>Le Conscient (Cs)</h3>
<p>Système en contact direct avec le monde extérieur. Perception, pensée rationnelle, parole. Fonctionnement selon le principe de réalité.</p>
<h3>Le Préconscient (Pcs)</h3>
<p>Réservoir de souvenirs et pensées accessibles à la conscience par un effort d’attention. Fonctionne comme un filtre entre inconscient et conscient.</p>
<h3>L’Inconscient (Ics)</h3>
<p>Siège des désirs refoulés, des pulsions et des représentations interdites. Fonctionne selon le principe de plaisir. Se manifeste à travers les rêves, les actes manqués, les symptômes.</p>`,
  });

  const c1m3l2 = await insertLesson({
    moduleId: c1m3,
    title: "La seconde topique : Ça, Moi, Surmoi",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 20,
  });

  const c1m3l3 = await insertLesson({
    moduleId: c1m3,
    title: "Quiz — Topiques freudiennes",
    position: 2,
    contentType: "text",
    durationMinutes: 8,
  });
  const c1m3e1 = await insertExercise(
    c1m3l3,
    "Quiz topiques freudiennes",
    "quiz",
    0,
    3,
  );
  await insertQuizQuestions(c1m3e1, [
    {
      questionText:
        "Selon Freud, quel principe régit le fonctionnement de l’inconscient ?",
      options: [
        { id: "a", text: "Le principe de réalité" },
        { id: "b", text: "Le principe de plaisir" },
        { id: "c", text: "Le principe de constance" },
        { id: "d", text: "Le principe d’économie" },
      ],
      correctOptionId: "b",
      explanation:
        "L’inconscient fonctionne selon le principe de plaisir : il cherche la satisfaction immédiate des pulsions sans tenir compte de la réalité extérieure.",
    },
    {
      questionText:
        "Dans la seconde topique, quelle instance représente les interdits intériorisés ?",
      options: [
        { id: "a", text: "Le Ça" },
        { id: "b", text: "Le Moi" },
        { id: "c", text: "Le Surmoi" },
        { id: "d", text: "Le Préconscient" },
      ],
      correctOptionId: "c",
      explanation:
        "Le Surmoi est l’instance qui représente les interdits parentaux et sociaux intériorisés, agissant comme une conscience morale interne.",
    },
    {
      questionText:
        "Quel phénomène quotidien constitue, selon Freud, « la voie royale vers l’inconscient » ?",
      options: [
        { id: "a", text: "Les actes manqués" },
        { id: "b", text: "Les lapsus" },
        { id: "c", text: "Le rêve" },
        { id: "d", text: "Le transfert" },
      ],
      correctOptionId: "c",
      explanation:
        "Freud a qualifié le rêve de « voie royale vers l’inconscient » dans L’Interprétation du rêve (1900), car le rêve exprime les désirs refoulés sous forme déguisée.",
    },
  ]);

  // Module 4 — U6: Cerveau, émotions et attachement (Bowlby)
  const c1m4 = await insertModule(
    course1Id,
    "U6 — Cerveau, émotions et attachement",
    "Théorie de l’attachement de Bowlby, neurosciences affectives et régulation émotionnelle.",
    3,
  );
  const c1m4l1 = await insertLesson({
    moduleId: c1m4,
    title: "La théorie de l’attachement de John Bowlby",
    position: 0,
    contentType: "text",
    durationMinutes: 20,
    contentBody: `<h2>L’attachement : un besoin fondamental</h2>
<p>John Bowlby (1907–1990) a révolutionné la psychologie du développement en montrant que le besoin d’attachement est un besoin primaire, aussi fondamental que la faim ou la soif.</p>
<h3>Les 4 styles d’attachement (Ainsworth)</h3>
<ul>
  <li><strong>Sécure</strong> — L’enfant explore avec confiance, revient vers la figure d’attachement en cas de stress.</li>
  <li><strong>Insecure-évitant</strong> — L’enfant évite le contact avec la figure d’attachement, semble indifférent.</li>
  <li><strong>Insecure-ambivalent</strong> — L’enfant est à la fois en quête et en rejet de la proximité.</li>
  <li><strong>Désorganisé</strong> — Comportements contradictoires, souvent liés à des traumatismes précoces.</li>
</ul>
<h3>Implications cliniques</h3>
<p>Le style d’attachement établi dans l’enfance influence les relations adultes, la régulation émotionnelle et la vulnérabilité aux troubles psychiques. La psychothérapie peut permettre de « gagner en sécurité » (earned security).</p>`,
  });

  const c1m4l2 = await insertLesson({
    moduleId: c1m4,
    title: "Neurosciences affectives et régulation émotionnelle",
    position: 1,
    contentType: "pdf",
    contentUrl:
      "https://web.dev/static/articles/vitals/image/core-web-vitals-overview.pdf",
    durationMinutes: 25,
  });

  // ── Course 2: Psychologie de l’enfant ───────────────────────────────────

  console.log("  Building course 2: Psychologie de l’enfant...");

  const course2Id = await upsertCourse({
    slug: "psychologie-enfant",
    title: "Psychologie de l’enfant et du développement",
    description:
      "Développement psycho-affectif de l’enfant, stades du développement (Piaget, Wallon, Freud), troubles du développement et prises en charge adaptées. 480 heures de formation à distance.",
    instructorId: leblancId,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800",
  });

  // Module 1
  const c2m1 = await insertModule(
    course2Id,
    "Les stades du développement",
    "Piaget, Wallon, Freud : les grandes théories du développement de l’enfant.",
    0,
  );
  const c2m1l1 = await insertLesson({
    moduleId: c2m1,
    title: "Les stades du développement selon Piaget",
    position: 0,
    contentType: "text",
    durationMinutes: 18,
    contentBody: `<h2>Les stades du développement cognitif</h2>
<p>Jean Piaget (1896–1980) a identifié quatre stades du développement cognitif :</p>
<h3>1. Stade sensori-moteur (0–2 ans)</h3>
<p>L’intelligence se construit à travers l’action et la perception. Acquisition de la permanence de l’objet.</p>
<h3>2. Stade préopératoire (2–7 ans)</h3>
<p>Émergence du langage et de la pensée symbolique. Égocentrisme intellectuel, centration.</p>
<h3>3. Stade des opérations concrètes (7–11 ans)</h3>
<p>Raisonnement logique appliqué à des situations concrètes. Conservation, classification, sériation.</p>
<h3>4. Stade des opérations formelles (11 ans+)</h3>
<p>Pensée abstraite et hypothético-déductive. Raisonnement sur des propositions logiques.</p>`,
  });

  const c2m1l2 = await insertLesson({
    moduleId: c2m1,
    title: "Le développement psycho-affectif (Freud, Wallon)",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 20,
  });

  const c2m1l3 = await insertLesson({
    moduleId: c2m1,
    title: "Quiz — Développement de l’enfant",
    position: 2,
    contentType: "text",
    durationMinutes: 8,
  });
  const c2m1e1 = await insertExercise(
    c2m1l3,
    "Quiz développement de l’enfant",
    "quiz",
    0,
    3,
  );
  await insertQuizQuestions(c2m1e1, [
    {
      questionText:
        "Selon Piaget, à quel stade l’enfant acquiert-il la permanence de l’objet ?",
      options: [
        { id: "a", text: "Stade sensori-moteur" },
        { id: "b", text: "Stade préopératoire" },
        { id: "c", text: "Stade des opérations concrètes" },
        { id: "d", text: "Stade des opérations formelles" },
      ],
      correctOptionId: "a",
      explanation:
        "La permanence de l’objet s’acquiert au stade sensori-moteur (0–2 ans) : l’enfant comprend qu’un objet continue d’exister même lorsqu’il est hors de sa vue.",
    },
    {
      questionText:
        "Quel phénomène caractérise le stade préopératoire selon Piaget ?",
      options: [
        { id: "a", text: "La pensée hypothético-déductive" },
        { id: "b", text: "La conservation des quantités" },
        { id: "c", text: "L’égocentrisme intellectuel" },
        { id: "d", text: "La réversibilité logique" },
      ],
      correctOptionId: "c",
      explanation:
        "L’égocentrisme intellectuel est une caractéristique majeure du stade préopératoire : l’enfant ne peut adopter un point de vue différent du sien.",
    },
    {
      questionText:
        "Quel psychologue français a développé une théorie des stades du développement basée sur la dialectique émotion-cognition ?",
      options: [
        { id: "a", text: "Jean Piaget" },
        { id: "b", text: "Henri Wallon" },
        { id: "c", text: "Sigmund Freud" },
        { id: "d", text: "Françoise Dolto" },
      ],
      correctOptionId: "b",
      explanation:
        "Henri Wallon a proposé une théorie intégrant les dimensions émotionnelle, sociale et cognitive du développement, avec des stades marqués par l’alternance entre intégration et différenciation.",
    },
  ]);

  // Module 2
  const c2m2 = await insertModule(
    course2Id,
    "Troubles du développement",
    "TSA, TDAH, troubles dys, retard de développement : repérage et prise en charge.",
    1,
  );
  const c2m2l1 = await insertLesson({
    moduleId: c2m2,
    title: "Les troubles du spectre autistique (TSA)",
    position: 0,
    contentType: "text",
    durationMinutes: 22,
  });
  const c2m2l2 = await insertLesson({
    moduleId: c2m2,
    title: "TDAH : diagnostic et accompagnement",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 18,
  });
  const c2m2l3 = await insertLesson({
    moduleId: c2m2,
    title: "Les troubles des apprentissages (dys)",
    position: 2,
    contentType: "pdf",
    contentUrl:
      "https://web.dev/static/articles/vitals/image/core-web-vitals-overview.pdf",
    durationMinutes: 15,
  });

  // ── Course 3: Modules complémentaires (TCC, systémique) ────────────────

  console.log("  Building course 3: Modules complémentaires...");

  const course3Id = await upsertCourse({
    slug: "modules-complementaires",
    title: "Modules complémentaires — Psychothérapies & pratique",
    description:
      "TCC (Thérapies Cognitives et Comportementales), approche systémique, psychothérapie intégrative, travail sur soi et compétences pratiques du psychopraticien.",
    instructorId: clairembeaudId,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800",
  });

  // Module 1
  const c3m1 = await insertModule(
    course3Id,
    "TCC — Thérapies Cognitives et Comportementales",
    "Principes, techniques et applications des TCC dans la pratique clinique.",
    0,
  );
  const c3m1l1 = await insertLesson({
    moduleId: c3m1,
    title: "Fondements des TCC",
    position: 0,
    contentType: "text",
    durationMinutes: 20,
    contentBody: `<h2>Les TCC : principes fondamentaux</h2>
<p>Les thérapies cognitives et comportementales (TCC) reposent sur l’idée que les troubles psychiques sont liés à des pensées dysfonctionnelles et des comportements inadaptés, qui peuvent être modifiés par un travail thérapeutique structuré.</p>
<h3>Les trois vagues des TCC</h3>
<ul>
  <li><strong>1ère vague : comportementale</strong> — Conditionnement classique (Pavlov), opérant (Skinner), exposition et désensibilisation.</li>
  <li><strong>2ème vague : cognitive</strong> — Restructuration cognitive (Beck), thérapie rationnelle-émotive (Ellis), identification des schémas dysfonctionnels.</li>
  <li><strong>3ème vague : émotionnelle et métacognitive</strong> — Pleine conscience (MBCT), ACT (Acceptance and Commitment Therapy), thérapie des schémas (Young).</li>
</ul>`,
  });

  const c3m1l2 = await insertLesson({
    moduleId: c3m1,
    title: "La restructuration cognitive selon Beck",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 18,
  });

  // Module 2
  const c3m2 = await insertModule(
    course3Id,
    "Approche systémique et familiale",
    "Penser le symptôme dans le contexte du système familial et relationnel.",
    1,
  );
  const c3m2l1 = await insertLesson({
    moduleId: c3m2,
    title: "Introduction à la pensée systémique",
    position: 0,
    contentType: "text",
    durationMinutes: 15,
  });
  const c3m2l2 = await insertLesson({
    moduleId: c3m2,
    title: "La thérapie familiale en pratique",
    position: 1,
    contentType: "video",
    contentUrl: "https://www.youtube.com/embed/bixR-KIJKYM",
    durationMinutes: 20,
  });

  // ═══════════════════════════════════════════════════════════════════════════

  // ======================================================================

  console.log("  Creating assignment exercises...");

  const c1m1a1 = await insertExercise(
    c1m1l1,
    "Analyse de cas clinique — Structure névrotique",
    "assignment",
    1,
    20,
  );

  const c1m1a2 = await insertExercise(
    c1m1l2,
    "Réflexion — Mécanismes de défense observés en stage",
    "reflection",
    1,
    10,
  );

  const c1m2a1 = await insertExercise(
    c1m2l1,
    "Étude de cas — Diagnostic différentiel névrose vs psychose",
    "assignment",
    1,
    20,
  );

  // ENROLMENTS & PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("  Creating enrolments and progress...");

  // Collect all lesson IDs for progress
  const c1Lessons = [
    c1m1l1,
    c1m1l2,
    c1m1l3,
    c1m2l1,
    c1m2l2,
    c1m2l3,
    c1m2l4,
    c1m3l1,
    c1m3l2,
    c1m3l3,
    c1m4l1,
    c1m4l2,
  ];
  const c2Lessons = [c2m1l1, c2m1l2, c2m1l3, c2m2l1, c2m2l2, c2m2l3];
  const c3Lessons = [c3m1l1, c3m1l2, c3m2l1, c3m2l2];

  const c1EnrolIds: { studentId: string; enrolId: string }[] = [];

  // Enrol most students in course 1
  for (let i = 0; i < 12; i++) {
    const sid = studentIds[i];
    if (sid === undefined) continue;
    const enrolId = await enrol(sid, course1Id, adminId);
    if (enrolId === undefined) continue;
    c1EnrolIds.push({ studentId: sid, enrolId });

    // Mark varied progress
    if (i < 3) {
      // First 3 students: nearly complete
      for (const lid of c1Lessons) {
        await markProgress(enrolId, lid, "completed");
      }
    } else if (i < 7) {
      // Next 4: halfway through
      for (let j = 0; j < 6; j++) {
        const lid = c1Lessons[j];
        if (lid === undefined) continue;
        await markProgress(enrolId, lid, j < 5 ? "completed" : "in_progress");
      }
    } else {
      // Rest: just started
      const lid = c1Lessons[0];
      if (lid !== undefined) {
        await markProgress(enrolId, lid, "in_progress");
      }
    }
  }

  // Enrol some in course 2
  for (let i = 0; i < 8; i++) {
    const sid = studentIds[i];
    if (sid === undefined) continue;
    const enrolId = await enrol(sid, course2Id, adminId);
    if (enrolId === undefined) continue;

    if (i < 2) {
      for (const lid of c2Lessons) {
        await markProgress(enrolId, lid, "completed");
      }
    } else if (i < 5) {
      for (let j = 0; j < 3; j++) {
        const lid = c2Lessons[j];
        if (lid === undefined) continue;
        await markProgress(enrolId, lid, j < 2 ? "completed" : "in_progress");
      }
    }
  }

  // Enrol some in course 3
  for (let i = 2; i < 10; i++) {
    const sid = studentIds[i];
    if (sid === undefined) continue;
    const enrolId = await enrol(sid, course3Id, adminId);
    if (enrolId === undefined) continue;

    if (i < 5) {
      for (let j = 0; j < 2; j++) {
        const lid = c3Lessons[j];
        if (lid === undefined) continue;
        await markProgress(enrolId, lid, "completed");
      }
    }
  }

  // ======================================================================
  // SAMPLE SUBMISSIONS (HOMEWORK)
  // ======================================================================

  console.log("  Creating sample submissions...");

  const e0 = c1EnrolIds[0];
  if (e0 !== undefined) {
    await db.insert(submissions).values({
      exerciseId: c1m1a1,
      enrolmentId: e0.enrolId,
      studentId: e0.studentId,
      body: "Dans ce cas clinique, le patient présente une organisation névrotique de type hystérique. L’angoisse de castration est manifeste dans les symptômes de conversion. Les mécanismes de défense prédominants sont le refoulement et la conversion somatique. Le conflit intrapsychique se situe au niveau œdipien. La relation d’objet est de type génitale, bien que marquée par l’ambivalence.",
      status: "graded",
      score: 17,
      feedback:
        "Très bonne analyse structurale. Vous identifiez correctement les mécanismes de défense et le niveau de conflit. Attention à ne pas négliger les éléments dépressifs sous-jacents. Approfondissez la question du narcissisme.",
      gradedBy: clairembeaudId,
      gradedAt: new Date(Date.now() - 2 * 86400000),
    });
  }

  const e1 = c1EnrolIds[1];
  if (e1 !== undefined) {
    await db.insert(submissions).values({
      exerciseId: c1m1a1,
      enrolmentId: e1.enrolId,
      studentId: e1.studentId,
      body: "Le patient présente selon moi une structure psychotique décompensée. Les hallucinations auditives et le délire de persécution sont au premier plan. L’angoisse est de type morcellement. Les mécanismes de défense sont archaïques : déni de la réalité, projection, clivage du moi.",
      status: "submitted",
    });
  }

  const e2 = c1EnrolIds[2];
  if (e2 !== undefined) {
    await db.insert(submissions).values({
      exerciseId: c1m1a1,
      enrolmentId: e2.enrolId,
      studentId: e2.studentId,
      body: "L’examen clinique révèle un fonctionnement limite (borderline). L’angoisse d’abandon domine le tableau clinique, se manifestant par des conduites autodestructrices et une instabilité relationnelle majeure. Le clivage de l’objet est le mécanisme de défense principal.",
      status: "submitted",
    });
  }

  if (e0 !== undefined) {
    await db.insert(submissions).values({
      exerciseId: c1m1a2,
      enrolmentId: e0.enrolId,
      studentId: e0.studentId,
      body: "Durant mon stage en service de psychiatrie adulte, j’ai pu observer plusieurs mécanismes de défense. Un patient présentant un trouble obsessionnel utilisait massivement l’isolation de l’affect et l’annulation rétroactive. Ce qui m’a le plus frappé, c’est la différence entre les défenses névrotiques et psychotiques.",
      status: "graded",
      score: 8,
      feedback:
        "Bonne observation clinique. Vous faites bien la distinction entre défenses névrotiques et psychotiques. Essayez d’approfondir la notion de contre-transfert.",
      gradedBy: clairembeaudId,
      gradedAt: new Date(Date.now() - 3 * 86400000),
    });
  }

  const e3 = c1EnrolIds[3];
  if (e3 !== undefined) {
    await db.insert(submissions).values({
      exerciseId: c1m2a1,
      enrolmentId: e3.enrolId,
      studentId: e3.studentId,
      body: "Le diagnostic différentiel entre névrose grave et psychose repose sur plusieurs critères : la nature de l’angoisse, l’épreuve de réalité, et les mécanismes de défense. Dans le cas présenté, je penche pour un diagnostic de névrose grave car l’épreuve de réalité est préservée.",
      status: "submitted",
    });
  }

  const e4 = c1EnrolIds[4];
  if (e4 !== undefined) {
    await db.insert(submissions).values({
      exerciseId: c1m2a1,
      enrolmentId: e4.enrolId,
      studentId: e4.studentId,
      body: "La question du diagnostic différentiel se pose ici de manière particulièrement aiguë. L’analyse approfondie révèle un fonctionnement névrotique : le refoulement est le mécanisme central, l’angoisse est liée à la castration symbolique.",
      status: "graded",
      score: 16,
      feedback:
        "Analyse nuancée et bien argumentée. Vous pourriez aller plus loin dans l’analyse du transfert.",
      gradedBy: clairembeaudId,
      gradedAt: new Date(Date.now() - 86400000),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("  Creating messages...");

  const s0 = studentIds[0];
  const s1 = studentIds[1];
  const s2 = studentIds[2];

  if (s0 !== undefined && s1 !== undefined && s2 !== undefined) {
    // Thread 1: student <-> teacher
    const t1rows = await db
      .insert(messageThreads)
      .values({ participantA: s0, participantB: clairembeaudId })
      .returning({ id: messageThreads.id });
    const t1 = t1rows[0]?.id;
    if (t1 !== undefined) {
      await db.insert(messages).values({
        threadId: t1,
        senderId: s0,
        body: "Bonjour M. Clairembeaud, je ne comprends pas bien la différence entre un état-limite et une névrose grave. Pouvez-vous m’éclairer ?",
        readAt: new Date(),
      });
      await db.insert(messages).values({
        threadId: t1,
        senderId: clairembeaudId,
        body: "La différence fondamentale réside dans l’organisation défensive : l’état-limite utilise principalement le clivage de l’objet, tandis que la névrose grave emploie des mécanismes plus évolués comme le refoulement, même si intensifiés.",
      });
    }

    // Thread 2: admin -> student
    const t2rows = await db
      .insert(messageThreads)
      .values({ participantA: adminId, participantB: s0 })
      .returning({ id: messageThreads.id });
    const t2 = t2rows[0]?.id;
    if (t2 !== undefined) {
      await db.insert(messages).values({
        threadId: t2,
        senderId: adminId,
        body: "Bienvenue dans votre espace de formation ! N’hésitez pas à nous contacter si vous avez la moindre question.",
      });
    }

    // Thread 3: student <-> teacher about child development
    const t3rows = await db
      .insert(messageThreads)
      .values({ participantA: s1, participantB: leblancId })
      .returning({ id: messageThreads.id });
    const t3 = t3rows[0]?.id;
    if (t3 !== undefined) {
      await db.insert(messages).values({
        threadId: t3,
        senderId: s1,
        body: "Madame Dubois-Faure, quelles sont les principales différences entre la théorie de Piaget et celle de Wallon ?",
        readAt: new Date(),
      });
      await db.insert(messages).values({
        threadId: t3,
        senderId: leblancId,
        body: "Excellente question ! Wallon intègre davantage la dimension émotionnelle et sociale dans le développement, là où Piaget se concentre sur la dimension cognitive. Pour Wallon, l’émotion est le premier mode de communication avec l’environnement.",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("  Creating notifications...");

  if (s0 !== undefined) {
    await db.insert(notifications).values([
      {
        userId: s0,
        type: "new_message",
        title: "Nouveau message",
        body: "M. Clairembeaud a répondu à votre question sur les états-limites.",
        entityType: "message",
        entityId: "1",
      },
      {
        userId: s0,
        type: "enrolment_created",
        title: "Inscription confirmée",
        body: "Vous êtes inscrit(e) à Psychologie clinique.",
        entityType: "course",
        entityId: course1Id,
      },
    ]);
  }

  if (s1 !== undefined) {
    await db.insert(notifications).values([
      {
        userId: s1,
        type: "new_message",
        title: "Nouveau message",
        body: "Mme Dubois-Faure a répondu à votre question sur Piaget et Wallon.",
        entityType: "message",
        entityId: "1",
      },
    ]);
  }

  // Teacher notifications
  await db.insert(notifications).values([
    {
      userId: clairembeaudId,
      type: "new_message",
      title: "Nouveau message",
      body: "Marie Dupont vous a envoyé une question sur les états-limites.",
      entityType: "message",
      entityId: "1",
    },
  ]);

  // Admin notification
  await db.insert(notifications).values([
    {
      userId: adminId,
      type: "enrolment_created",
      title: "Nouvelle inscription",
      body: "12 étudiants se sont inscrits à Psychologie clinique.",
      entityType: "course",
      entityId: course1Id,
    },
  ]);

  console.log("\n✅ Seed complete!\n");
  console.log("  Demo accounts:");
  console.log("    Admin:   admin@praxisa.fr       / Admin1234!");
  console.log("    Teacher: prof.martin@praxisa.fr / Teacher1234!");
  console.log("             prof.leblanc@praxisa.fr / Teacher1234!");
  console.log("    Student: marie.dupont@praxisa.fr / Student1234!");
}

// ── Run ──────────────────────────────────────────────────────────────────────

seed()
  .catch((err: unknown) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
  });
