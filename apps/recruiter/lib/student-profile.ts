import { prisma, studentMatchesIndustryWhere, type Prisma } from "@studentos/db";

export type StudentListItem = {
  id: string;
  name: string;
  department: string | null;
  semester: string | null;
  careerGoal: string | null;
  institution: string | null;
  dsaSolved: number;
};

/**
 * Students visible to this recruiter: opted in (`visibleToRecruiters`) AND matched to the
 * recruiter's industry (packages/db/src/recruiter-matching.ts — no industry set on either side
 * means "show everyone"). Never includes a student who hasn't explicitly opted in, full stop.
 */
export async function listVisibleStudents(params: { industry: string | null; query?: string }): Promise<StudentListItem[]> {
  const where: Prisma.UserWhereInput = {
    visibleToRecruiters: true,
    ...studentMatchesIndustryWhere(params.industry),
    ...(params.query ? { name: { contains: params.query, mode: "insensitive" } } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { visibleToRecruitersAt: "desc" },
    take: 100,
    include: {
      institution: { select: { name: true } },
      _count: { select: { dsaAttempts: true } },
    },
  });

  const solvedCounts = await prisma.dsaAttempt.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, solved: true },
    _count: { _all: true },
  });
  const solvedByUser = new Map(solvedCounts.map((s) => [s.userId, s._count._all]));

  return users.map((u) => ({
    id: u.id,
    name: u.name ?? "Student",
    department: u.department,
    semester: u.semester,
    careerGoal: u.careerGoal,
    institution: u.institution?.name ?? null,
    dsaSolved: solvedByUser.get(u.id) ?? 0,
  }));
}

export type StudentDetail = StudentListItem & {
  skills: string[];
  links: { github?: string; linkedin?: string; portfolio?: string };
  projects: { id: string; title: string }[];
  resume: { id: string } | null;
  interviewStats: { count: number; avgScore: number | null };
};

/** Full recruiter-facing profile for one student — requires `visibleToRecruiters`. */
export async function getStudentDetail(id: string): Promise<StudentDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { institution: { select: { name: true } } },
  });
  if (!user || !user.visibleToRecruiters) return null;

  const [solvedCount, projectDocs, resumeDoc, interviewDocs] = await Promise.all([
    prisma.dsaAttempt.count({ where: { userId: id, solved: true } }),
    prisma.document.findMany({ where: { ownerId: id, type: "PROJECT" }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, title: true } }),
    prisma.document.findFirst({ where: { ownerId: id, type: "RESUME", status: "READY" }, orderBy: { updatedAt: "desc" }, select: { id: true } }),
    prisma.document.findMany({
      where: { ownerId: id, type: "INTERVIEW", status: "READY" },
      select: { content: { select: { data: true } } },
    }),
  ]);

  // Interview evaluation JSON shape is packages/ai/src/interview.ts InterviewEvaluationSchema —
  // { overall: number, ... }. Read defensively since it's freeform Json, not a typed column.
  const scores = interviewDocs
    .map((d) => (d.content?.data as { overall?: unknown } | null)?.overall)
    .filter((v): v is number => typeof v === "number");
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  let skills: string[] = [];
  let links: StudentDetail["links"] = {};
  if (resumeDoc) {
    const content = await prisma.documentContent.findUnique({ where: { documentId: resumeDoc.id }, select: { data: true } });
    const resume = content?.data as { skills?: { items?: string[] }[]; contact?: { github?: string; linkedin?: string; portfolio?: string } } | undefined;
    skills = resume?.skills?.flatMap((g) => g.items ?? []).slice(0, 16) ?? [];
    links = { github: resume?.contact?.github, linkedin: resume?.contact?.linkedin, portfolio: resume?.contact?.portfolio };
  }

  return {
    id: user.id,
    name: user.name ?? "Student",
    department: user.department,
    semester: user.semester,
    careerGoal: user.careerGoal,
    institution: user.institution?.name ?? null,
    dsaSolved: solvedCount,
    skills,
    links,
    projects: projectDocs.map((p) => ({ id: p.id, title: p.title })),
    resume: resumeDoc ? { id: resumeDoc.id } : null,
    interviewStats: { count: interviewDocs.length, avgScore },
  };
}
