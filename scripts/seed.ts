/* Initial content. Safe to re-run: existing records are never overwritten. */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, s } from "../src/db";

const L = (hy: string, ru: string, en: string) => ({ hy, ru, en });

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

  await db.insert(s.directions).values({
    slug: "programming", icon: "code", order: 1,
    title: L("Ծրագրավորում", "Программирование", "Programming"),
    description: L("Վեբ ծրագրավորում զրոյից՝ ֆրոնթենդ և բեքենդ, իրական նախագծերով։", "Веб-разработка с нуля — фронтенд и бэкенд, на реальных проектах.", "Web development from scratch — frontend and backend, with real projects."),
  }).onConflictDoNothing();
  const [dir] = await db.select().from(s.directions).where(eq(s.directions.slug, "programming"));

  const courses = [
    {
      slug: "frontend", code: "ՖՎԾ-01", order: 1, hours: 84, theoryHours: 24, practiceHours: 60, weeks: 14, lessonsPerWeek: 3, priceMonthly: 50000, priceFull: 175000, priceIndividual: 125000, months: 4, minAge: 14,
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
        ["Մ2", 14, L("CSS, Flexbox, Grid և ադապտիվ դիզայն", "CSS, Flexbox, Grid и адаптивный дизайн", "CSS, Flexbox, Grid and responsive design")],
        ["Մ3", 16, L("JavaScript-ի հիմունքներ", "Основы JavaScript", "JavaScript fundamentals")],
        ["Մ4", 12, L("DOM, իրադարձություններ և ասինխրոն JavaScript", "DOM, события и асинхронный JavaScript", "DOM, events and asynchronous JavaScript")],
        ["Մ5", 4, L("Git, GitHub և մշակողի գործիքներ", "Git, GitHub и инструменты разработчика", "Git, GitHub and developer tools")],
        ["Մ6", 16, L("React", "React", "React")],
        ["Մ7", 12, L("Ավարտական նախագիծ", "Выпускной проект", "Final project")],
      ] as const,
    },
    {
      slug: "backend-nodejs", code: "ԲՎԾ-01", order: 2, hours: 60, theoryHours: 18, practiceHours: 42, weeks: 10, lessonsPerWeek: 3, priceMonthly: 50000, priceFull: 125000, priceIndividual: 125000, months: 3, minAge: 16,
      title: L("Բեքենդ ծրագրավորում Node.js-ով", "Бэкенд-разработка на Node.js", "Backend Development with Node.js"),
      summary: L("Node.js, Express, REST API, PostgreSQL և ինտեգրացիաներ՝ աշխատող սերվերային հավելված։", "Node.js, Express, REST API, PostgreSQL и интеграции — рабочее серверное приложение.", "Node.js, Express, REST APIs, PostgreSQL and integrations — a working server application."),
      description: L(
        "Դասընթացը նրանց համար է, ովքեր արդեն տիրապետում են JavaScript-ի հիմունքներին և ցանկանում են ստեղծել սերվերային հավելվածներ։ Կսովորեք կառուցել REST API, աշխատել տվյալների բազաների հետ, ապահովել նույնականացում և ինտեգրել արտաքին ծառայություններ, այդ թվում WhatsApp-ը։\n\nԱվարտին ներկայացնում եք ամբողջական բեքենդ նախագիծ։",
        "Курс для тех, кто уже знает основы JavaScript и хочет создавать серверные приложения. Вы научитесь строить REST API, работать с базами данных, делать аутентификацию и интегрировать внешние сервисы, включая WhatsApp.\n\nВ конце вы защищаете полноценный бэкенд-проект.",
        "For those who already know JavaScript basics and want to build server applications. You will learn to build REST APIs, work with databases, implement authentication and integrate external services, including WhatsApp.\n\nYou finish by presenting a complete backend project."
      ),
      level: L("Միջին", "Средний", "Intermediate"),
      requirements: L("JavaScript-ի հիմունքների իմացություն (օր.՝ ՖՎԾ-01 դասընթացի Մ3–Մ4 մոդուլների մակարդակով)։", "Знание основ JavaScript (например, на уровне модулей М3–М4 курса ФВЦ-01).", "Knowledge of JavaScript basics (e.g. modules M3–M4 of the Frontend course)."),
      outcomes: {
        hy: ["Գրել սերվերային կոդ Node.js-ով", "Կառուցել REST API Express-ով", "Աշխատել PostgreSQL-ի և SQL-ի հետ", "Իրականացնել նույնականացում և անվտանգություն", "Ինտեգրել արտաքին API-ներ, այդ թվում WhatsApp", "Տեղակայել նախագիծը սերվերում"],
        ru: ["Писать серверный код на Node.js", "Строить REST API на Express", "Работать с PostgreSQL и SQL", "Реализовать аутентификацию и безопасность", "Интегрировать внешние API, включая WhatsApp", "Развернуть проект на сервере"],
        en: ["Write server code with Node.js", "Build REST APIs with Express", "Work with PostgreSQL and SQL", "Implement authentication and security", "Integrate external APIs, including WhatsApp", "Deploy a project to a server"],
      },
      modules: [
        ["Մ1", 8, L("Node.js-ի հիմունքներ", "Основы Node.js", "Node.js fundamentals")],
        ["Մ2", 14, L("Express և REST API", "Express и REST API", "Express and REST APIs")],
        ["Մ3", 12, L("Տվյալների բազաներ՝ SQL և PostgreSQL", "Базы данных: SQL и PostgreSQL", "Databases: SQL and PostgreSQL")],
        ["Մ4", 6, L("Նույնականացում և անվտանգություն", "Аутентификация и безопасность", "Authentication and security")],
        ["Մ5", 8, L("Ինտեգրացիաներ և WhatsApp API", "Интеграции и WhatsApp API", "Integrations and the WhatsApp API")],
        ["Մ6", 4, L("Թեստավորում և տեղակայում", "Тестирование и деплой", "Testing and deployment")],
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
    { slug: "contract", title: L("Պայմանագրի օրինակ", "Образец договора", "Sample contract"), body: L(
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
  console.log("✓ pages\nDone.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
