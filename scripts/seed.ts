/* Initial content. Safe to re-run: existing records are never overwritten. */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, s } from "../src/db";
import { CONTRACT_TEMPLATE } from "../src/lib/contract-template";

const L = (hy: string, ru: string, en: string) => ({ hy, ru, en });
const LEGACY_TITLES: Record<string, string> = {
  "frontend:Մ2": "CSS, Flexbox, Grid և ադապտիվ դիզայն", "frontend:Մ5": "Git, GitHub և մշակողի գործիքներ", "frontend:Մ6": "React",
  "backend-nodejs:Մ1": "Node.js-ի հիմունքներ", "backend-nodejs:Մ2": "Express և REST API", "backend-nodejs:Մ3": "Տվյալների բազաներ՝ SQL և PostgreSQL",
  "backend-nodejs:Մ4": "Նույնականացում և անվտանգություն", "backend-nodejs:Մ5": "Ինտեգրացիաներ և WhatsApp API", "backend-nodejs:Մ6": "Թեստավորում և տեղակայում",
};

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (email && password) {
    const admins = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "ADMIN")).limit(1);
    // Only bootstrap the first admin. Once an admin exists (even if they later change their email
    // or password in the profile), the env values are never used again.
    if (!admins.length) {
      const ex = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      if (!ex.length) await db.insert(s.users).values({ email, name: "Լիաննա Գալստյան", passwordHash: await bcrypt.hash(password, 11), role: "ADMIN" });
      else await db.update(s.users).set({ role: "ADMIN" }).where(eq(s.users.id, ex[0].id));
      console.log("✓ admin", email);
    }
  } else console.warn("! ADMIN_EMAIL / ADMIN_PASSWORD not set — admin not created");

  // Nov 2026: the test learner «Եվա Սահակյան» was made an admin by mistake — back to learner (only while another admin exists)
  {
    const admins = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "ADMIN"));
    if (admins.length > 1) {
      const r = await db.update(s.users).set({ role: "STUDENT" }).where(and(eq(s.users.email, "liana.galstyan.87@mail.ru"), eq(s.users.role, "ADMIN"))).returning({ id: s.users.id });
      if (r.length) console.log("✓ Eva Sahakyan is a learner again");
    }
  }
  // One-time move of the public/notification e-mail to the academy address (Nov 2026)
  await db.execute(sql`update settings set value = replace(value::text, 'galstyan.liana.87@gmail.com', 'altaacademy666@gmail.com')::jsonb where value::text like '%galstyan.liana.87@gmail.com%'`);
  await db.execute(sql`update pages set body = replace(body::text, 'galstyan.liana.87@gmail.com', 'altaacademy666@gmail.com')::jsonb where body::text like '%galstyan.liana.87@gmail.com%'`);

  await db.insert(s.directions).values({
    slug: "programming", icon: "code", order: 1,
    title: L("Ծրագրավորում", "Программирование", "Programming"),
    description: L("Վեբ ծրագրավորում զրոյից՝ ֆրոնթենդ և բեքենդ, իրական նախագծերով։", "Веб-разработка с нуля — фронтенд и бэкенд, на реальных проектах.", "Web development from scratch — frontend and backend, with real projects."),
  }).onConflictDoNothing();
  const [dir] = await db.select().from(s.directions).where(eq(s.directions.slug, "programming"));

  const courses = [
    {
      slug: "frontend", code: "ՖՎԾ-01", order: 1, hours: 84, theoryHours: 24, practiceHours: 60, weeks: 14, lessonsPerWeek: 3, priceMonthly: 50000, priceFull: 175000, priceIndividual: 125000, months: 4, minAge: 16,
      title: L("Ֆրոնթենդ վեբ ծրագրավորում", "Фронтенд веб-разработка", "Frontend Web Development"),
      summary: L("HTML, CSS, JavaScript և React՝ զրոյից մինչև սեփական ադապտիվ վեբ հավելված։", "HTML, CSS, JavaScript и React — с нуля до собственного адаптивного веб-приложения.", "HTML, CSS, JavaScript and React — from zero to your own responsive web app."),
      description: L(
        "Դասընթացը նախատեսված է նրանց համար, ովքեր ցանկանում են զրոյից սովորել ժամանակակից ֆրոնթենդ ծրագրավորում։ Յուրաքանչյուր դաս կառուցված է «տեսություն + գործնական առաջադրանք» սկզբունքով, իսկ ավարտին դուք ներկայացնում եք սեփական նախագիծը, որը կարող եք ավելացնել ձեր փորձապանակում։\n\nԴասերն անցնում են կենդանի առցանց ձևաչափով՝ մինչև 12 հոգանոց խմբերով, բոլոր դասերը ձայնագրվում են։",
        "Курс для тех, кто хочет с нуля освоить современную фронтенд-разработку. Каждое занятие построено по принципу «теория + практическое задание», а в конце вы защищаете собственный проект для портфолио.\n\nЗанятия проходят вживую онлайн в группах до 12 человек, все уроки записываются.",
        "A course for those who want to learn modern frontend development from scratch. Every lesson follows a “theory + hands-on task” format, and at the end you present your own portfolio project.\n\nLessons are live online in groups of up to 12, and every lesson is recorded."
      ),
      level: L("Սկսնակ", "Начальный", "Beginner"),
      requirements: L("Համակարգչից օգտվելու հիմնական հմտություններ, համակարգիչ՝ ինտերնետ կապով։ Նախնական գիտելիքներ պետք չեն։", "Базовые навыки работы с компьютером, компьютер с интернетом. Предварительные знания не нужны.", "Basic computer skills and a computer with internet. No prior knowledge needed."),
      outcomes: {
        hy: ["Կառուցել ադապտիվ վեբ էջեր HTML-ով և CSS-ով", "Գրել JavaScript ծրագրեր և աշխատել DOM-ի հետ", "Աշխատել API-ների և ասինխրոն կոդի հետ", "Ստեղծել React հավելվածներ կոմպոնենտներով", "Օգտվել Git-ից և GitHub-ից", "Ներկայացնել ավարտական նախագիծ"],
        ru: ["Верстать адаптивные страницы на HTML и CSS", "Писать программы на JavaScript и работать с DOM", "Работать с API и асинхронным кодом", "Создавать React-приложения на компонентах", "Пользоваться Git и GitHub", "Защитить выпускной проект"],
        en: ["Build responsive pages with HTML and CSS", "Write JavaScript and work with the DOM", "Work with APIs and asynchronous code", "Create component-based React apps", "Use Git and GitHub", "Present a final project"],
      },
      modules: [
        ["Մ1", 10, L("Վեբի հիմունքներ և HTML", "Основы веба и HTML", "Web basics and HTML")],
        ["Մ2", 14, L("CSS և հարմարվող ձևավորում", "CSS и адаптивная вёрстка", "CSS and responsive design")],
        ["Մ3", 16, L("JavaScript-ի հիմունքներ", "Основы JavaScript", "JavaScript fundamentals")],
        ["Մ4", 12, L("DOM, իրադարձություններ և ասինխրոն JavaScript", "DOM, события и асинхронный JavaScript", "DOM, events and asynchronous JavaScript")],
        ["Մ5", 4, L("Git, GitHub և կայքի հրապարակում", "Git, GitHub и публикация сайта", "Git, GitHub and publishing a site")],
        ["Մ6", 16, L("React-ի հիմունքներ", "Основы React", "React fundamentals")],
        ["Մ7", 12, L("Ավարտական նախագիծ", "Выпускной проект", "Final project")],
      ] as const,
    },
    {
      slug: "backend-nodejs", code: "ԲՎԾ-01", order: 2, hours: 60, theoryHours: 18, practiceHours: 42, weeks: 10, lessonsPerWeek: 3, priceMonthly: 50000, priceFull: 125000, priceIndividual: 125000, months: 3, minAge: 16,
      title: L("Բեքենդ ծրագրավորում Node.js-ով", "Бэкенд-разработка на Node.js", "Backend Development with Node.js"),
      summary: L("Node.js, Express, REST API, PostgreSQL, Prisma և անվտանգություն՝ աշխատող սերվերային հավելված։", "Node.js, Express, REST API, PostgreSQL, Prisma и безопасность — рабочее серверное приложение.", "Node.js, Express, REST APIs, PostgreSQL, Prisma and security — a working server application."),
      description: L(
        "Դասընթացը նրանց համար է, ովքեր արդեն տիրապետում են JavaScript-ի հիմունքներին և ցանկանում են ստեղծել սերվերային հավելվածներ։ Կսովորեք կառուցել REST API, աշխատել տվյալների բազաների հետ, ապահովել նույնականացում և անվտանգություն, թեստավորել և հրապարակել սերվերային հավելվածը։\n\nԱվարտին ներկայացնում եք ամբողջական բեքենդ նախագիծ։",
        "Курс для тех, кто уже знает основы JavaScript и хочет создавать серверные приложения. Вы научитесь строить REST API, работать с базами данных, делать аутентификацию и защиту, тестировать и публиковать серверное приложение.\n\nВ конце вы защищаете полноценный бэкенд-проект.",
        "For those who already know JavaScript basics and want to build server applications. You will learn to build REST APIs, work with databases, implement authentication and security, then test and deploy a server application.\n\nYou finish by presenting a complete backend project."
      ),
      level: L("Միջին", "Средний", "Intermediate"),
      requirements: L("JavaScript-ի հիմունքների իմացություն (օր.՝ ՖՎԾ-01 դասընթացի Մ3–Մ4 մոդուլների մակարդակով)։", "Знание основ JavaScript (например, на уровне модулей М3–М4 курса ФВЦ-01).", "Knowledge of JavaScript basics (e.g. modules M3–M4 of the Frontend course)."),
      outcomes: {
        hy: ["Գրել սերվերային կոդ Node.js-ով", "Կառուցել REST API Express-ով", "Աշխատել PostgreSQL-ի և SQL-ի հետ", "Իրականացնել նույնականացում և անվտանգություն", "Աշխատել Prisma ORM-ի և MongoDB-ի հետ", "Տեղակայել նախագիծը սերվերում"],
        ru: ["Писать серверный код на Node.js", "Строить REST API на Express", "Работать с PostgreSQL и SQL", "Реализовать аутентификацию и безопасность", "Работать с Prisma ORM и MongoDB", "Развернуть проект на сервере"],
        en: ["Write server code with Node.js", "Build REST APIs with Express", "Work with PostgreSQL and SQL", "Implement authentication and security", "Work with Prisma ORM and MongoDB", "Deploy a project to a server"],
      },
      modules: [
        ["Մ1", 8, L("Node.js-ի հիմունքներ և npm", "Основы Node.js и npm", "Node.js fundamentals and npm")],
        ["Մ2", 14, L("HTTP, REST և Express", "HTTP, REST и Express", "HTTP, REST and Express")],
        ["Մ3", 12, L("Տվյալների բազաներ և SQL (PostgreSQL)", "Базы данных и SQL (PostgreSQL)", "Databases and SQL (PostgreSQL)")],
        ["Մ4", 6, L("ORM (Prisma) և MongoDB-ի հիմունքներ", "ORM (Prisma) и основы MongoDB", "ORM (Prisma) and MongoDB basics")],
        ["Մ5", 8, L("Նույնականացում և անվտանգություն", "Аутентификация и безопасность", "Authentication and security")],
        ["Մ6", 4, L("Թեստավորում և հրապարակում", "Тестирование и публикация", "Testing and deployment")],
        ["Մ7", 8, L("Ավարտական նախագիծ", "Выпускной проект", "Final project")],
      ] as const,
    },
  ];

  for (const { modules, ...c } of courses) {
    const ins = await db.insert(s.courses).values({ ...c, directionId: dir.id, certificateUrl: "/images/certificate-sample.webp" }).onConflictDoNothing().returning();
    if (ins.length) {
      await db.insert(s.courseModules).values(modules.map(([code, hours, title], i) => ({ courseId: ins[0].id, code, hours, title, order: i })));
      console.log("✓ course", c.code);
    }
  }

  // AI direction and courses (programs ԱԲՀ-01, ԱԲՄ-01, ԱԲԾ-01 submitted to the Ministry).
  await db.insert(s.directions).values({
    slug: "ai", icon: "sparkles", order: 2,
    title: L("Արհեստական բանականություն", "Искусственный интеллект", "Artificial Intelligence"),
    description: L("AI գործիքներ աշխատանքի, բիզնեսի և ծրագրավորման համար՝ գործնական առաջադրանքներով։", "AI-инструменты для работы, бизнеса и программирования — с практическими заданиями.", "AI tools for work, business and programming — with hands-on practice."),
  }).onConflictDoNothing();
  const [aiDir] = await db.select().from(s.directions).where(eq(s.directions.slug, "ai"));

  const aiCourses = [
    {
      slug: "ai-for-everyone", code: "ԱԲՀ-01", order: 3, hours: 36, theoryHours: 12, practiceHours: 24, weeks: 6, lessonsPerWeek: 2, priceMonthly: 32500, priceFull: 65000, priceIndividual: 125000, months: 2, minAge: 16,
      title: L("Արհեստական բանականության գործիքներ բոլորի համար", "AI-инструменты для всех", "AI Tools for Everyone"),
      summary: L("ChatGPT, Claude, Gemini և այլ AI գործիքներ աշխատանքի, ուսման և առօրյայի համար՝ առանց ծրագրավորման։", "ChatGPT, Claude, Gemini и другие AI-инструменты для работы, учёбы и жизни — без программирования.", "ChatGPT, Claude, Gemini and other AI tools for work, study and everyday life — no coding needed."),
      description: L(
        "Դասընթացը նախատեսված է բոլոր նրանց համար, ովքեր ցանկանում են արհեստական բանականության գործիքներն օգտագործել ամեն օր՝ արդյունավետ, քննադատաբար և անվտանգ։ Կսովորեք ճիշտ հարցումներ (prompt) կազմել, AI-ով գրել նամակներ և փաստաթղթեր, աշխատել աղյուսակների ու ներկայացումների հետ, ստեղծել պատկերներ, ձայն և կարճ վիդեոներ, ինչպես նաև ստուգել AI-ի տված տեղեկատվությունը։\n\nԴասերն անցնում են կենդանի առցանց ձևաչափով՝ մինչև 12 հոգանոց խմբերով, շաբաթը 2 անգամ, բոլոր դասերը ձայնագրվում են։",
        "Курс для всех, кто хочет каждый день пользоваться инструментами искусственного интеллекта — эффективно, критично и безопасно. Вы научитесь составлять запросы (промпты), писать с помощью AI письма и документы, работать с таблицами и презентациями, создавать изображения, озвучку и короткие видео, а также проверять информацию от AI.\n\nЗанятия проходят вживую онлайн в группах до 12 человек 2 раза в неделю, все уроки записываются.",
        "A course for anyone who wants to use artificial intelligence tools every day — effectively, critically and safely. You will learn to write good prompts, draft emails and documents with AI, work with spreadsheets and presentations, create images, voice-overs and short videos, and fact-check what AI tells you.\n\nLessons are live online in groups of up to 12, twice a week, and every lesson is recorded."
      ),
      level: L("Սկսնակ", "Начальный", "Beginner"),
      requirements: L("Համակարգչի կամ սմարթֆոնի և համացանցի հետ աշխատելու հիմնական հմտություններ։ Ծրագրավորման կամ AI-ի նախնական գիտելիքներ պետք չեն։", "Базовые навыки работы с компьютером или смартфоном и интернетом. Знания программирования или AI не нужны.", "Basic computer or smartphone and internet skills. No programming or AI knowledge needed."),
      outcomes: {
        hy: ["Կազմել հստակ հարցումներ (prompt) և ստանալ որակյալ արդյունք", "AI-ով գրել նամակներ, փաստաթղթեր և ամփոփումներ", "AI-ով աշխատել աղյուսակների և ներկայացումների հետ", "Ստուգել AI-ի տված տեղեկատվությունը և գտնել սխալները", "Ստեղծել պատկերներ, ձայնային ուղեկցում և կարճ վիդեոներ", "Պաշտպանել անձնական տվյալները և պահպանել էթիկական կանոնները"],
        ru: ["Составлять чёткие запросы и получать качественный результат", "Писать с AI письма, документы и резюме текстов", "Работать с AI в таблицах и презентациях", "Проверять информацию, которую даёт AI", "Создавать изображения, озвучку и короткие видео", "Защищать личные данные и соблюдать этические нормы"],
        en: ["Write clear prompts and get quality results", "Draft emails, documents and summaries with AI", "Use AI with spreadsheets and presentations", "Fact-check information from AI", "Create images, voice-overs and short videos", "Protect personal data and use AI ethically"],
      },
      modules: [
        ["Մ-01", 3, L("Ներածություն արհեստական բանականությանը", "Введение в искусственный интеллект", "Introduction to artificial intelligence")],
        ["Մ-02", 6, L("Հարցումների (prompt) կազմման հիմունքներ", "Основы составления запросов (промптов)", "Prompting fundamentals")],
        ["Մ-03", 6, L("AI-ն աշխատանքում և ուսման մեջ", "AI в работе и учёбе", "AI for work and study")],
        ["Մ-04", 3, L("Տեղեկատվության որոնում և ստուգում", "Поиск и проверка информации", "Searching and fact-checking")],
        ["Մ-05", 6, L("Պատկերների, ձայնի և վիդեոյի ստեղծում", "Создание изображений, звука и видео", "Creating images, audio and video")],
        ["Մ-06", 3, L("Անձնական արտադրողականություն", "Личная продуктивность", "Personal productivity")],
        ["Մ-07", 3, L("Անվտանգություն և էթիկա", "Безопасность и этика", "Safety and ethics")],
        ["Մ-08", 6, L("Ավարտական նախագիծ", "Выпускной проект", "Final project")],
      ] as const,
    },
    {
      slug: "ai-for-business", code: "ԱԲՄ-01", order: 4, hours: 36, theoryHours: 12, practiceHours: 24, weeks: 6, lessonsPerWeek: 2, priceMonthly: 47500, priceFull: 95000, priceIndividual: 125000, months: 2, minAge: 18,
      title: L("Արհեստական բանականությունը բիզնեսում և մարքեթինգում", "AI в бизнесе и маркетинге", "AI for Business and Marketing"),
      summary: L("Կոնտենտ, reels, չաթբոտներ և ավտոմատացում AI-ով՝ ձեր բիզնեսի համար, առանց ծրագրավորման։", "Контент, reels, чат-боты и автоматизация с AI — для вашего бизнеса, без программирования.", "Content, reels, chatbots and automation with AI — for your business, no coding needed."),
      description: L(
        "Դասընթացը նախատեսված է անհատ ձեռնարկատերերի, փոքր և միջին բիզնեսի աշխատողների, SMM և մարքեթինգի մասնագետների համար։ Կսովորեք AI-ով կազմել կոնտենտ պլան, գրել գրառումներ և սցենարներ, ստեղծել բրենդային պատկերներ ու կարճ վիդեոներ, կարգավորել չաթբոտ հաճախորդների հարցերի համար և ավտոմատացնել կրկնվող աշխատանքը no-code գործիքներով։\n\nԲոլոր առաջադրանքները կատարվում են ձեր իրական բիզնեսի վրա, ուստի դասընթացի ավարտին ունենում եք օգտագործման պատրաստ նյութեր։ Դասերն անցնում են կենդանի առցանց ձևաչափով՝ շաբաթը 2 անգամ, բոլոր դասերը ձայնագրվում են։",
        "Курс для индивидуальных предпринимателей, сотрудников малого и среднего бизнеса, SMM- и маркетинг-специалистов. Вы научитесь с помощью AI составлять контент-план, писать посты и сценарии, создавать брендовые изображения и короткие видео, настраивать чат-бота для вопросов клиентов и автоматизировать рутину no-code инструментами.\n\nВсе задания выполняются на вашем реальном бизнесе, поэтому к концу курса у вас готовые материалы. Занятия проходят вживую онлайн 2 раза в неделю, все уроки записываются.",
        "For sole entrepreneurs, small and medium business staff, and SMM and marketing specialists. You will learn to build a content plan with AI, write posts and scripts, create on-brand images and short videos, set up a chatbot for customer questions and automate routine work with no-code tools.\n\nEvery assignment is done on your real business, so you finish the course with ready-to-use materials. Lessons are live online twice a week and every lesson is recorded."
      ),
      level: L("Սկսնակ", "Начальный", "Beginner"),
      requirements: L("Համակարգչի և սոցիալական ցանցերի հետ աշխատելու հիմնական հմտություններ։ Ցանկալի է գործող բիզնես կամ բիզնես գաղափար։ Ծրագրավորում պետք չէ։", "Базовые навыки работы с компьютером и соцсетями. Желательно действующий бизнес или бизнес-идея. Программирование не нужно.", "Basic computer and social media skills. An existing business or business idea is recommended. No coding needed."),
      outcomes: {
        hy: ["Գտնել բիզնեսի այն գործընթացները, որտեղ AI-ն կխնայի ժամանակ", "AI-ով կազմել ամսական կոնտենտ պլան", "Գրել գրառումներ, սցենարներ և գովազդային տեքստեր", "Ստեղծել բրենդային պատկերներ և կարճ վիդեոներ", "Կարգավորել չաթբոտ հաճախորդների հարցերի համար", "Ավտոմատացնել կրկնվող աշխատանքը no-code գործիքներով"],
        ru: ["Находить процессы бизнеса, где AI сэкономит время", "Составлять месячный контент-план с AI", "Писать посты, сценарии и рекламные тексты", "Создавать брендовые изображения и короткие видео", "Настраивать чат-бота для вопросов клиентов", "Автоматизировать рутину no-code инструментами"],
        en: ["Spot business processes where AI saves time", "Build a monthly content plan with AI", "Write posts, scripts and ad copy", "Create on-brand images and short videos", "Set up a chatbot for customer questions", "Automate routine work with no-code tools"],
      },
      modules: [
        ["Մ-01", 3, L("AI-ն բիզնեսում՝ հնարավորություններ և սահմանափակումներ", "AI в бизнесе: возможности и ограничения", "AI in business: possibilities and limits")],
        ["Մ-02", 3, L("Հարցումներ բիզնես խնդիրների համար", "Запросы для бизнес-задач", "Prompts for business tasks")],
        ["Մ-03", 3, L("Բրենդ և կոնտենտ ռազմավարություն", "Бренд и контент-стратегия", "Brand and content strategy")],
        ["Մ-04", 3, L("Տեքստային կոնտենտ", "Текстовый контент", "Written content")],
        ["Մ-05", 6, L("Վիզուալ կոնտենտ", "Визуальный контент", "Visual content")],
        ["Մ-06", 6, L("Վիդեո և կարճ վիդեոներ (reels)", "Видео и короткие ролики (reels)", "Video and short-form reels")],
        ["Մ-07", 3, L("Հաճախորդների սպասարկում և չաթբոտներ", "Обслуживание клиентов и чат-боты", "Customer service and chatbots")],
        ["Մ-08", 3, L("Գործընթացների ավտոմատացում", "Автоматизация процессов", "Process automation")],
        ["Մ-09", 3, L("Վերլուծություն և որոշումների կայացում", "Аналитика и принятие решений", "Analytics and decision-making")],
        ["Մ-10", 3, L("Ավարտական նախագիծ", "Выпускной проект", "Final project")],
      ] as const,
    },
    {
      slug: "ai-for-developers", code: "ԱԲԾ-01", order: 5, hours: 72, theoryHours: 22, practiceHours: 50, weeks: 12, lessonsPerWeek: 2, priceMonthly: 70000, priceFull: 210000, priceIndividual: 125000, months: 3, minAge: 16,
      title: L("Արհեստական բանականության կիրառումը վեբ ծրագրավորման մեջ", "AI в веб-разработке", "AI for Web Developers"),
      summary: L("LLM API-ներ, չաթբոտներ (Telegram, WhatsApp), RAG և AI գործակալներ Node.js-ով՝ մինչև հրապարակված AI հավելված։", "LLM API, чат-боты (Telegram, WhatsApp), RAG и AI-агенты на Node.js — до опубликованного AI-приложения.", "LLM APIs, chatbots (Telegram, WhatsApp), RAG and AI agents with Node.js — up to a deployed AI app."),
      description: L(
        "Դասընթացը նախատեսված է JavaScript-ին տիրապետող ծրագրավորողների համար, ովքեր ցանկանում են AI-ով արագացնել իրենց աշխատանքը և ստեղծել AI-ով աշխատող վեբ հավելվածներ։ Կսովորեք աշխատել Cursor-ի, Claude Code-ի և Copilot-ի հետ, միացնել OpenAI և Anthropic API-ները Node.js-ով, ստանալ կառուցվածքային պատասխաններ, մշակել չաթբոտներ կայքի, Telegram-ի և WhatsApp-ի (GREEN-API) համար, կառուցել փաստաթղթերից պատասխանող RAG համակարգ և AI գործակալներ (agents, MCP), ապա անվտանգ հրապարակել հավելվածը։\n\nԱվարտին ներկայացնում եք սեփական AI հավելվածը՝ հրապարակված համացանցում և GitHub-ում։ Դասերն անցնում են կենդանի առցանց ձևաչափով՝ մինչև 10 հոգանոց խմբերով, բոլոր դասերը ձայնագրվում են։",
        "Курс для программистов, владеющих JavaScript, которые хотят ускорить работу с помощью AI и создавать веб-приложения на основе AI. Вы научитесь работать с Cursor, Claude Code и Copilot, подключать API OpenAI и Anthropic на Node.js, получать структурированные ответы, разрабатывать чат-ботов для сайта, Telegram и WhatsApp (GREEN-API), строить RAG-систему, отвечающую по документам, и AI-агентов (agents, MCP), а затем безопасно публиковать приложение.\n\nВ конце вы защищаете собственное AI-приложение, опубликованное в интернете и на GitHub. Занятия проходят вживую онлайн в группах до 10 человек, все уроки записываются.",
        "For developers who know JavaScript and want to speed up their work with AI and build AI-powered web apps. You will learn to work with Cursor, Claude Code and Copilot, connect the OpenAI and Anthropic APIs from Node.js, get structured outputs, build chatbots for the web, Telegram and WhatsApp (GREEN-API), build a RAG system that answers from documents and AI agents (agents, MCP), then deploy the app securely.\n\nYou finish by presenting your own AI app, live on the web and on GitHub. Lessons are live online in groups of up to 10 and every lesson is recorded."
      ),
      level: L("Միջին", "Средний", "Intermediate"),
      requirements: L("JavaScript-ի հիմունքներ (ֆունկցիաներ, զանգվածներ, օբյեկտներ, async/await), Node.js-ի և Git-ի հիմնական գիտելիքներ (օր.՝ ՖՎԾ-01 կամ ԲՎԾ-01 դասընթացի մակարդակով)։", "Основы JavaScript (функции, массивы, объекты, async/await), базовые знания Node.js и Git (например, на уровне курса ФВЦ-01 или БВЦ-01).", "JavaScript basics (functions, arrays, objects, async/await) and basic Node.js and Git (e.g. the level of the Frontend or Backend course)."),
      outcomes: {
        hy: ["Արդյունավետ և անվտանգ ծրագրավորել AI օգնականներով", "Միացնել LLM API-ներ Node.js հավելվածներին", "Ստանալ կառուցվածքային պատասխաններ և օգտագործել գործիքների կանչ (tool calling)", "Մշակել չաթբոտներ կայքի, Telegram-ի և WhatsApp-ի համար", "Կառուցել RAG համակարգ և AI գործակալներ", "Հրապարակել AI հավելվածը՝ անվտանգության և ծախսերի վերահսկմամբ"],
        ru: ["Эффективно и безопасно программировать с AI-ассистентами", "Подключать LLM API к приложениям на Node.js", "Получать структурированные ответы и использовать tool calling", "Разрабатывать чат-ботов для сайта, Telegram и WhatsApp", "Строить RAG-систему и AI-агентов", "Публиковать AI-приложение с контролем безопасности и расходов"],
        en: ["Code effectively and safely with AI assistants", "Connect LLM APIs to Node.js apps", "Get structured outputs and use tool calling", "Build chatbots for the web, Telegram and WhatsApp", "Build a RAG system and AI agents", "Deploy an AI app with security and cost control"],
      },
      modules: [
        ["Մ-01", 3, L("Լեզվական մոդելների աշխատանքի սկզբունքներ", "Как работают языковые модели", "How language models work")],
        ["Մ-02", 6, L("AI-ով ծրագրավորում", "Программирование с AI", "Coding with AI")],
        ["Մ-03", 9, L("LLM API-ների ինտեգրում Node.js-ով", "Интеграция LLM API на Node.js", "Integrating LLM APIs with Node.js")],
        ["Մ-04", 6, L("Կառուցվածքային պատասխաններ և tool calling", "Структурированные ответы и tool calling", "Structured outputs and tool calling")],
        ["Մ-05", 9, L("Չաթբոտների մշակում", "Разработка чат-ботов", "Building chatbots")],
        ["Մ-06", 12, L("Embeddings և RAG համակարգեր", "Embeddings и RAG-системы", "Embeddings and RAG systems")],
        ["Մ-07", 9, L("AI գործակալներ (agents) և ավտոմատացում", "AI-агенты и автоматизация", "AI agents and automation")],
        ["Մ-08", 3, L("Մուլտիմոդալ AI", "Мультимодальный AI", "Multimodal AI")],
        ["Մ-09", 6, L("Հրապարակում, անվտանգություն և ծախսերի կառավարում", "Публикация, безопасность и контроль расходов", "Deployment, security and cost control")],
        ["Մ-10", 9, L("Ավարտական նախագիծ", "Выпускной проект", "Final project")],
      ] as const,
    },
  ];

  for (const { modules, ...c } of aiCourses) {
    const ins = await db.insert(s.courses).values({ ...c, directionId: aiDir.id, certificateUrl: "/images/certificate-sample.webp" }).onConflictDoNothing().returning();
    if (ins.length) {
      await db.insert(s.courseModules).values(modules.map(([code, hours, title], i) => ({ courseId: ins[0].id, code, hours, title, order: i })));
      console.log("✓ course", c.code);
    }
  }


  // Keep AI courses identical to the programmes submitted to the Ministry (only values still equal to earlier defaults are changed).
  const AI_OLD: Record<string, { title: string; outcomes: string[] }> = {"ai-for-everyone": {"title": "AI գործիքներ բոլորի համար", "outcomes": ["Կազմել հստակ հարցումներ և ստանալ որակյալ արդյունք", "AI-ով գրել նամակներ, փաստաթղթեր և ամփոփումներ", "AI-ով աշխատել աղյուսակների և ներկայացումների հետ", "Ստուգել AI-ի տված տեղեկատվությունը", "Ստեղծել պատկերներ, ձայն և կարճ վիդեոներ", "Պաշտպանել անձնական տվյալները և պահպանել էթիկական կանոնները"]}, "ai-for-business": {"title": "AI բիզնեսում և մարքեթինգում", "outcomes": ["Գտնել բիզնեսի այն գործընթացները, որտեղ AI-ը կխնայի ժամանակ", "AI-ով կազմել ամսական կոնտենտ պլան", "Գրել գրառումներ, սցենարներ և գովազդային տեքստեր", "Ստեղծել բրենդային պատկերներ և կարճ վիդեոներ", "Կարգավորել չաթբոտ հաճախորդների հարցերի համար", "Ավտոմատացնել կրկնվող աշխատանքը no-code գործիքներով"]}, "ai-for-developers": {"title": "AI-ի կիրառումը վեբ ծրագրավորման մեջ", "outcomes": ["Արդյունավետ և անվտանգ ծրագրավորել AI օգնականներով", "Միացնել LLM API-ներ Node.js հավելվածներին", "Ստանալ կառուցվածքային պատասխաններ և օգտագործել tool calling", "Մշակել չաթբոտներ կայքի, Telegram-ի և WhatsApp-ի համար", "Կառուցել RAG համակարգ և AI գործակալներ", "Հրապարակել AI հավելվածը՝ անվտանգության և ծախսերի վերահսկմամբ"]}};
  const AI_OLD_MODULES: Record<string, string> = { "ai-for-everyone:Մ-03": "AI-ը աշխատանքում և ուսման մեջ", "ai-for-business:Մ-01": "AI-ը բիզնեսում՝ հնարավորություններ և սահմանափակումներ" };
  for (const c of aiCourses) {
    const [row] = await db.select().from(s.courses).where(eq(s.courses.slug, c.slug)).limit(1);
    if (!row) continue;
    const old = AI_OLD[c.slug];
    // Prices: one-time payment equals the sum of monthly payments (no discount). Only earlier defaults are replaced.
    const AI_OLD_PRICES: Record<string, [number, number]> = { "ai-for-everyone": [35000, 65000], "ai-for-business": [50000, 95000], "ai-for-developers": [70000, 195000] };
    const [oldMonthly, oldFull] = AI_OLD_PRICES[c.slug];
    if (row.priceMonthly === oldMonthly && row.priceFull === oldFull) await db.update(s.courses).set({ priceMonthly: c.priceMonthly, priceFull: c.priceFull }).where(eq(s.courses.id, row.id));
    if ((row.title as { hy: string }).hy === old.title) await db.update(s.courses).set({ title: c.title }).where(eq(s.courses.id, row.id));
    if (JSON.stringify((row.outcomes as { hy: string[] }).hy) === JSON.stringify(old.outcomes)) await db.update(s.courses).set({ outcomes: c.outcomes }).where(eq(s.courses.id, row.id));
    const mods = await db.select().from(s.courseModules).where(eq(s.courseModules.courseId, row.id));
    for (const [code, , title] of c.modules) {
      const m = mods.find((x) => x.code === code);
      const legacy = AI_OLD_MODULES[`${c.slug}:${code}`];
      if (m && legacy && (m.title as { hy: string }).hy === legacy) await db.update(s.courseModules).set({ title }).where(eq(s.courseModules.id, m.id));
    }
  }

  // Align existing courses with the programs submitted to the Ministry,
  // touching only values that still equal the original defaults (admin edits are kept).
  for (const c of courses) {
    const [row] = await db.select().from(s.courses).where(eq(s.courses.slug, c.slug)).limit(1);
    if (!row) continue;
    if (c.slug === "frontend" && row.minAge === 14) await db.update(s.courses).set({ minAge: 16 }).where(eq(s.courses.id, row.id));
    const old = (row.outcomes as { hy: string[] }).hy;
    if (old?.includes("Ինտեգրել արտաքին API-ներ, այդ թվում WhatsApp")) await db.update(s.courses).set({ outcomes: c.outcomes }).where(eq(s.courses.id, row.id));
    if ((row.description as { hy: string }).hy?.includes("այդ թվում WhatsApp-ը")) await db.update(s.courses).set({ description: c.description }).where(eq(s.courses.id, row.id));
    if ((row.summary as { hy: string }).hy?.includes("PostgreSQL և ինտեգրացիաներ")) await db.update(s.courses).set({ summary: c.summary }).where(eq(s.courses.id, row.id));
    const mods = await db.select().from(s.courseModules).where(eq(s.courseModules.courseId, row.id));
    for (const [code, , title] of c.modules) {
      const m = mods.find((x) => x.code === code);
      const legacy = LEGACY_TITLES[`${c.slug}:${code}`];
      if (m && legacy && (m.title as { hy: string }).hy === legacy) await db.update(s.courseModules).set({ title }).where(eq(s.courseModules.id, m.id));
    }
  }

  if (!(await db.select().from(s.faqs).limit(1)).length) {
    const faqs = [
      [L("Պե՞տք է արդյոք նախնական գիտելիք", "Нужны ли предварительные знания?", "Do I need prior knowledge?"), L("Ֆրոնթենդ դասընթացի համար՝ ոչ, սկսում ենք զրոյից։ Բեքենդ դասընթացի համար անհրաժեշտ է JavaScript-ի հիմունքների իմացություն։", "Для фронтенд-курса — нет, начинаем с нуля. Для бэкенд-курса нужны основы JavaScript.", "Not for the frontend course — we start from zero. The backend course requires JavaScript basics.")],
      [L("Ինչպե՞ս են անցնում դասերը", "Как проходят занятия?", "How are lessons held?"), L("Կենդանի առցանց դասեր՝ շաբաթը 3 անգամ, մինչև 12 հոգանոց խմբերով։ Բոլոր դասերը ձայնագրվում են, և դուք կարող եք վերադիտել դրանք։", "Живые онлайн-занятия 3 раза в неделю в группах до 12 человек. Все уроки записываются, их можно пересмотреть.", "Live online lessons 3 times a week in groups of up to 12. Every lesson is recorded so you can rewatch it.")],
      [L("Ո՞րն է տարբերությունը խմբակային և անհատական ուսուցման միջև", "Чем отличается групповое обучение от индивидуального?", "What is the difference between group and individual learning?"), L("Խմբակային դասերն անցնում են 6–12 հոգանոց խմբով՝ ֆիքսված դասացուցակով, և դա ամենամատչելի տարբերակն է։ Անհատական ձևաչափում դասավանդողը աշխատում է միայն ձեզ հետ, դասերի ժամերը համաձայնեցնում ենք ձեր գրաֆիկով, իսկ տեմպը հարմարեցվում է ձեր մակարդակին։ Ծրագիրը և վկայականը նույնն են։", "Групповые занятия проходят в группе 6–12 человек по фиксированному расписанию — это самый доступный вариант. В индивидуальном формате преподаватель работает только с вами, время занятий согласуем под ваш график, а темп подстраивается под ваш уровень. Программа и сертификат одинаковые.", "Group lessons run in groups of 6–12 on a fixed schedule — the most affordable option. In the individual format the instructor works only with you, lesson times fit your schedule and the pace adapts to your level. The programme and certificate are the same.")],
      [L("Ի՞նչ վկայական եմ ստանալու", "Какой сертификат я получу?", "What certificate will I get?"), L("Դասընթացն ավարտելուց և ավարտական նախագիծը պաշտպանելուց հետո տրվում է վկայական՝ եզակի համարով, որի իսկությունը կարելի է ստուգել կայքի «Ստուգել վկայականը» բաժնում։", "После окончания курса и защиты проекта выдаётся сертификат с уникальным номером, подлинность которого можно проверить на сайте.", "After completing the course and defending your project you receive a certificate with a unique number that can be verified on this site.")],
      [L("Ինչպե՞ս կարող եմ վճարել", "Как можно оплатить?", "How can I pay?"), L("Ամսական կամ ամբողջ դասընթացի համար միանգամից՝ բանկային քարտով կամ Idram-ով, անմիջապես կայքում։ Միանգամյա վճարման դեպքում գործում է զեղչ։ Ամսական վճարման դեպքում վճարման օրվանից 5 օր առաջ կստանաք հիշեցում էլ. փոստով, իսկ ամբողջ գրաֆիկը երևում է անձնական էջում։", "Помесячно или за весь курс сразу — банковской картой или Idram прямо на сайте. При оплате сразу действует скидка. При помесячной оплате за 5 дней до даты платежа придёт напоминание на e-mail, а весь график виден в личном кабинете.", "Monthly or for the whole course at once — by bank card or Idram right on the site. Paying in full gives a discount. On a monthly plan you get an email reminder 5 days before each payment, and the full schedule is in your account.")],
      [L("Կարո՞ղ եմ բաց թողած դասը լրացնել", "Можно ли наверстать пропущенный урок?", "Can I catch up on a missed lesson?"), L("Այո, բոլոր դասերի ձայնագրությունները հասանելի են ձեր անձնական էջում, իսկ հարցերը կարող եք տալ հաջորդ դասին կամ խմբի չաթում։", "Да, записи всех уроков доступны в личном кабинете, а вопросы можно задать на следующем занятии или в чате группы.", "Yes — recordings of all lessons are in your account, and you can ask questions in the next lesson or the group chat.")],
      [L("Հնարավո՞ր է գումարի վերադարձ", "Возможен ли возврат денег?", "Can I get a refund?"), L("Այո, վերադարձի պայմանները նկարագրված են «Վճարման և վերադարձի կանոններ» էջում։", "Да, условия возврата описаны на странице «Правила оплаты и возврата».", "Yes, the terms are described on the “Payment and refund rules” page.")],
    ] as const;
    await db.insert(s.faqs).values(faqs.map(([question, answer], i) => ({ question, answer, order: i })));
    console.log("✓ faq");
  }

  const pages = [
    { slug: "contract", title: L("Պայմանագրի նմուշ", "Образец договора", "Sample agreement"), body: CONTRACT_TEMPLATE ?? L(
      "## Կրթական ծառայությունների մատուցման պայմանագիր\n\n**Կատարող՝** ԱՁ Լիաննա Գալստյան, ՀՎՀՀ 58229843։\n\n**Պատվիրատու՝** ունկնդիրը (կամ անչափահասի դեպքում՝ ծնողը/օրինական ներկայացուցիչը)։\n\n### 1. Պայմանագրի առարկան\nԿատարողը մատուցում է առցանց ուսուցում՝ ընտրված դասընթացի ծրագրով, իսկ Պատվիրատուն վճարում է ծառայության դիմաց։\n\n### 2. Կողմերի պարտավորությունները\n- Կատարողն անցկացնում է դասերը դասացուցակին համապատասխան, տրամադրում ուսումնական նյութեր և դասերի ձայնագրություններ։\n- Պատվիրատուն մասնակցում է դասերին, կատարում առաջադրանքները և ժամանակին վճարում։\n\n### 3. Վճարում\nՎճարումը կատարվում է ամսական կամ միանգամից՝ կայքում նշված գներով, պայմանագիրը կնքելու պահին գործող սակագնով։ Կնքված պայմանագրի գինը միակողմանի չի փոփոխվում։\n\n### 4. Ավարտ և վկայական\nԾրագիրն ամբողջությամբ անցնելուց և ավարտական նախագիծը պաշտպանելուց հետո տրվում է վկայական։\n\n### 5. Լուծում\nԿողմերից յուրաքանչյուրը կարող է լուծել պայմանագիրը՝ գրավոր ծանուցելով, «Վճարման և վերադարձի կանոններին» համապատասխան։",
      "## Договор об оказании образовательных услуг\n\n**Исполнитель:** ИП Лианна Галстян, ИНН 58229843.\n\n**Заказчик:** слушатель (для несовершеннолетних — родитель/законный представитель).\n\n### 1. Предмет\nИсполнитель проводит онлайн-обучение по программе выбранного курса, Заказчик оплачивает услугу.\n\n### 2. Обязанности сторон\n- Исполнитель проводит занятия по расписанию, предоставляет материалы и записи уроков.\n- Заказчик посещает занятия, выполняет задания и своевременно оплачивает.\n\n### 3. Оплата\nПомесячно или единовременно по ценам сайта, действующим на момент заключения договора. Цена заключённого договора в одностороннем порядке не меняется.\n\n### 4. Завершение и сертификат\nПосле прохождения программы и защиты выпускного проекта выдаётся сертификат.\n\n### 5. Расторжение\nЛюбая сторона может расторгнуть договор письменным уведомлением согласно «Правилам оплаты и возврата».",
      "## Educational services agreement\n\n**Provider:** IE Lianna Galstyan, TIN 58229843.\n\n**Client:** the learner (or, for minors, a parent/legal guardian).\n\n### 1. Subject\nThe Provider delivers online training under the chosen course programme; the Client pays for the service.\n\n### 2. Obligations\n- The Provider holds lessons on schedule and provides materials and lesson recordings.\n- The Client attends lessons, completes assignments and pays on time.\n\n### 3. Payment\nMonthly or in full at the prices on the site at the time the agreement is signed. The price of a signed agreement is not changed unilaterally.\n\n### 4. Completion and certificate\nA certificate is issued after completing the programme and defending the final project.\n\n### 5. Termination\nEither party may terminate with written notice under the “Payment and refund rules”.") },
    { slug: "refund", title: L("Վճարման և վերադարձի կանոններ", "Правила оплаты и возврата", "Payment and refund rules"), body: L(
      "## Վճարում\n- Վճարումը կատարվում է կայքում՝ բանկային քարտով կամ Idram-ով։\n- Ամսական վճարման դեպքում հաջորդ ամսվա վճարը կատարվում է մինչև ամսվա առաջին դասը։\n- Ամբողջ դասընթացի միանգամյա վճարման դեպքում գործում է զեղչ։\n\n## Վերադարձ\n- Մինչև դասընթացի մեկնարկը՝ վճարված գումարը վերադարձվում է ամբողջությամբ։\n- Առաջին դասից հետո 3 օրվա ընթացքում՝ վերադարձվում է վճարված գումարը՝ հանած անցկացված դասերի արժեքը։\n- Հետագայում՝ վերադարձվում է չանցկացված դասերի արժեքը ընթացիկ վճարված ժամանակահատվածի համար։\n\nՎերադարձի համար գրեք մեզ էլ. փոստով կամ կայքի «Կապ» բաժնից։ Գումարը վերադարձվում է նույն եղանակով՝ 10 աշխատանքային օրվա ընթացքում։",
      "## Оплата\n- Оплата на сайте банковской картой или Idram.\n- При помесячной оплате платёж за следующий месяц вносится до первого занятия месяца.\n- При оплате всего курса сразу действует скидка.\n\n## Возврат\n- До старта курса — полный возврат.\n- В течение 3 дней после первого занятия — возврат за вычетом стоимости проведённых уроков.\n- Далее — возврат стоимости непроведённых уроков текущего оплаченного периода.\n\nДля возврата напишите нам на e-mail или через раздел «Контакты». Деньги возвращаются тем же способом в течение 10 рабочих дней.",
      "## Payment\n- Pay on the site by bank card or Idram.\n- For monthly plans, the next month is paid before its first lesson.\n- Paying for the whole course at once gives a discount.\n\n## Refunds\n- Before the course starts — full refund.\n- Within 3 days after the first lesson — refund minus the cost of lessons held.\n- Afterwards — refund of lessons not yet held in the current paid period.\n\nTo request a refund, email us or use the Contact page. Money is returned by the same method within 10 business days.") },
    { slug: "privacy", title: L("Գաղտնիության քաղաքականություն", "Политика конфиденциальности", "Privacy policy"), body: L(
      "Մենք հավաքում ենք միայն այն տվյալները, որոնք անհրաժեշտ են ուսուցում կազմակերպելու համար՝ անուն, էլ. փոստ, հեռախոս և վճարումների պատմություն։\n\n- Տվյալներն օգտագործվում են միայն ուսուցման, պայմանագրի, վկայականի և ձեզ հետ կապի համար։\n- Քարտի տվյալները մեզ մոտ չեն պահվում. վճարումը մշակվում է բանկի կամ Idram-ի անվտանգ էջում։\n- Տվյալները երրորդ անձանց չեն փոխանցվում, բացառությամբ օրենքով նախատեսված դեպքերի։\n- Կայքն օգտագործում է միայն անհրաժեշտ cookie-ներ՝ մուտքի և լեզվի ընտրության համար։\n\nՁեր տվյալները ջնջելու կամ փոփոխելու համար գրեք մեզ։ Գործում է «Անձնական տվյալների պաշտպանության մասին» ՀՀ օրենքը։",
      "Мы собираем только данные, необходимые для обучения: имя, e-mail, телефон и историю платежей.\n\n- Данные используются только для обучения, договора, сертификата и связи с вами.\n- Данные карт у нас не хранятся: оплата проходит на защищённой странице банка или Idram.\n- Данные не передаются третьим лицам, кроме случаев, предусмотренных законом.\n- Сайт использует только необходимые cookie — для входа и выбора языка.\n\nДля удаления или изменения данных напишите нам. Действует Закон РА «О защите персональных данных».",
      "We collect only the data needed to run your training: name, email, phone and payment history.\n\n- Data is used only for training, your agreement, certificate and contacting you.\n- We never store card data: payments are processed on the bank's or Idram's secure page.\n- Data is not shared with third parties except where required by law.\n- The site uses only essential cookies — for sign-in and language choice.\n\nTo delete or change your data, write to us. The RA Law on Personal Data Protection applies.") },
  ];
  for (const p of pages) await db.insert(s.pages).values(p).onConflictDoNothing();
  // Nov 2026: the agreement became a full template with the learner's data filled in by the site.
  // Replace it only while it is still the old built-in text (no {{placeholders}}), so admin edits are kept.
  const [cp] = await db.select().from(s.pages).where(eq(s.pages.slug, "contract")).limit(1);
  if (cp && !cp.body.hy.includes("{{")) {
    await db.update(s.pages).set({ title: L("Պայմանագրի նմուշ", "Образец договора", "Sample agreement"), body: CONTRACT_TEMPLATE }).where(eq(s.pages.slug, "contract"));
    console.log("✓ contract template");
  }
  // the one-time-payment discount applies only to some courses
  await db.execute(sql`update pages set body = replace(replace(replace(body::text,
    'Ամբողջ դասընթացի միանգամյա վճարման դեպքում գործում է զեղչ։', 'Որոշ դասընթացներում ամբողջ դասընթացի միանգամյա վճարման դեպքում գործում է զեղչ։'),
    'При оплате всего курса сразу действует скидка.', 'Для некоторых курсов при оплате всего курса сразу действует скидка.'),
    'Paying for the whole course at once gives a discount.', 'For some courses, paying for the whole course at once gives a discount.')::jsonb
    where slug = 'refund'`);
  console.log("✓ pages\nDone.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
