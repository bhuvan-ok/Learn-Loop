// Populates the database with a demo admin, a demo tutor, a demo student,
// one published course with real lesson content, a quiz, and an enrollment —
// enough to log in and try every feature (including the AI tutor) immediately.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const User = require('./models/User');
const Course = require('./models/Course');
const Lesson = require('./models/Lesson');
const LessonChunk = require('./models/LessonChunk');
const Quiz = require('./models/Quiz');
const QuizAttempt = require('./models/QuizAttempt');
const Enrollment = require('./models/Enrollment');
const Certificate = require('./models/Certificate');
const DiscussionPost = require('./models/DiscussionPost');
const ChatMessage = require('./models/ChatMessage');
const { indexLesson } = require('./services/lessonIndexingService');

const LESSONS = [
  {
    title: 'What is a Closure?',
    order: 0,
    content: `A closure is a function bundled together with references to its surrounding state (the lexical environment). In JavaScript, closures are created every time a function is created, at function creation time.

Concretely, a closure gives an inner function access to the variables of an outer function, even after the outer function has finished executing. This is why a function returned from another function can still "remember" the variables that were in scope when it was created.

Closures are commonly used to create private variables. Since JavaScript doesn't have a built-in way to make variables truly private, developers wrap them in a function and expose only specific inner functions that can read or modify them, while the variable itself stays inaccessible from outside.

A frequent pitfall involves closures inside loops. If you create a closure inside a "var" loop, all the closures will share the same variable reference, and by the time they run, the loop variable will already hold its final value. Using "let" instead of "var" fixes this because "let" creates a new binding for each iteration.`,
  },
  {
    title: 'Understanding the Event Loop',
    order: 1,
    content: `JavaScript is single-threaded, meaning it can only execute one piece of code at a time. The event loop is the mechanism that allows JavaScript to perform non-blocking operations despite this, by offloading tasks like timers, network requests, and file I/O to the browser or Node.js runtime, and queuing their callbacks to run later.

The call stack holds the function calls currently being executed. When an asynchronous operation like setTimeout or a fetch request is started, it is handed off to the browser/runtime API, and the JavaScript engine continues executing the rest of the synchronous code without waiting.

Once the asynchronous operation completes, its callback is placed into either the macrotask queue (for things like setTimeout and setInterval) or the microtask queue (for Promises and process.nextTick). The event loop constantly checks: if the call stack is empty, it first drains the entire microtask queue, and only then picks the next task from the macrotask queue.

This ordering explains why a Promise's .then() callback always runs before a setTimeout callback scheduled at the same time, even with a delay of 0 milliseconds — microtasks always take priority over macrotasks.`,
  },
  {
    title: 'REST API Design Basics',
    order: 2,
    content: `REST (Representational State Transfer) is an architectural style for designing networked applications, built around the idea of resources identified by URLs, manipulated through a small set of HTTP verbs.

The core verbs map to CRUD operations: GET retrieves a resource without side effects, POST creates a new resource, PUT replaces an existing resource entirely, PATCH partially updates a resource, and DELETE removes it. A well-designed REST API uses these verbs consistently instead of encoding actions into the URL itself.

Status codes communicate the outcome of a request: 200 OK for a successful GET/PUT/PATCH, 201 Created for a successful POST that creates a resource, 204 No Content for a successful request with no body to return, 400 Bad Request for invalid input, 401 Unauthorized when authentication is missing or invalid, 403 Forbidden when the authenticated user lacks permission, and 404 Not Found when the resource doesn't exist.

Good REST APIs are also stateless: each request must contain all the information needed to process it, since the server does not store any client session state between requests. This is what allows REST APIs to scale horizontally — any server instance can handle any request.`,
  },
];

const QUIZ = {
  title: 'JavaScript & REST Fundamentals Quiz',
  questions: [
    {
      questionText: 'What does a closure give an inner function access to?',
      options: [
        "The outer function's variables, even after it has returned",
        'Only global variables',
        "The browser's local storage",
        'Nothing beyond its own scope',
      ],
      correctOptionIndex: 0,
    },
    {
      questionText: 'Which queue does the event loop drain first when the call stack is empty?',
      options: ['The macrotask queue', 'The microtask queue', 'The rendering queue', 'Neither, it drains both randomly'],
      correctOptionIndex: 1,
    },
    {
      questionText: 'Which HTTP status code indicates a resource was successfully created?',
      options: ['200', '201', '204', '400'],
      correctOptionIndex: 1,
    },
  ],
};

async function seed() {
  await connectDB();

  console.log('Clearing existing demo data...');
  await Promise.all([
    User.deleteMany({ email: { $in: ['admin@demo.com', 'tutor@demo.com', 'student@demo.com'] } }),
  ]);
  const existingCourse = await Course.findOne({ title: 'JavaScript & Backend Fundamentals' });
  if (existingCourse) {
    // QuizAttempt is keyed by quiz, not course, so its quiz IDs must be
    // gathered before the Quiz documents themselves are deleted below.
    const oldQuizIds = await Quiz.find({ course: existingCourse._id }).distinct('_id');

    await Promise.all([
      Lesson.deleteMany({ course: existingCourse._id }),
      LessonChunk.deleteMany({ course: existingCourse._id }),
      Quiz.deleteMany({ course: existingCourse._id }),
      QuizAttempt.deleteMany({ quiz: { $in: oldQuizIds } }),
      Enrollment.deleteMany({ course: existingCourse._id }),
      Certificate.deleteMany({ course: existingCourse._id }),
      DiscussionPost.deleteMany({ course: existingCourse._id }),
      ChatMessage.deleteMany({ course: existingCourse._id }),
      existingCourse.deleteOne(),
    ]);
  }

  console.log('Creating demo users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await User.create({
    name: 'Alex Admin',
    email: 'admin@demo.com',
    passwordHash,
    role: 'admin',
  });
  const tutor = await User.create({
    name: 'Dr. Ava Tutor',
    email: 'tutor@demo.com',
    passwordHash,
    role: 'tutor',
  });
  const student = await User.create({
    name: 'Sam Student',
    email: 'student@demo.com',
    passwordHash,
    role: 'student',
  });

  console.log('Creating demo course...');
  const course = await Course.create({
    title: 'JavaScript & Backend Fundamentals',
    description:
      'A short course covering closures, the event loop, and REST API design — the concepts every backend/full-stack developer needs to explain confidently in interviews.',
    category: 'Web Development',
    tutor: tutor._id,
    published: true,
  });

  console.log('Creating lessons and indexing them for the AI tutor...');
  for (const lessonData of LESSONS) {
    const lesson = await Lesson.create({ course: course._id, ...lessonData });
    const chunkCount = await indexLesson(lesson);
    console.log(`  - "${lesson.title}": ${chunkCount} chunks indexed`);
  }

  console.log('Creating quiz...');
  await Quiz.create({ course: course._id, title: QUIZ.title, questions: QUIZ.questions });

  console.log('Enrolling demo student...');
  await Enrollment.create({ student: student._id, course: course._id });

  console.log('\nSeed complete. Demo accounts:');
  console.log('  Admin   -> admin@demo.com / password123');
  console.log('  Tutor   -> tutor@demo.com / password123');
  console.log('  Student -> student@demo.com / password123');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
