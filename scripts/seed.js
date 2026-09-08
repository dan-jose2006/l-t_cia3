require('dotenv').config();

const bcrypt = require('bcryptjs');
const connectDatabase = require('../config/db');
const User = require('../models/User');
const Book = require('../models/Book');
const MembershipPlan = require('../models/MembershipPlan');
const LibrarySetting = require('../models/LibrarySetting');

const plans = [
  { key: 'student-standard', name: 'Student Standard', memberType: 'student', maxBooks: 4, loanDays: 14, finePerDay: 5, graceDays: 1, isActive: true },
  { key: 'faculty-standard', name: 'Faculty Standard', memberType: 'faculty', maxBooks: 8, loanDays: 30, finePerDay: 2, graceDays: 2, isActive: true },
];

const sampleBooks = [
  ['Introduction to Algorithms', 'Thomas H. Cormen', '9780262046305', 'Computer Science', 6, 'A-01'],
  ['Artificial Intelligence: A Modern Approach', 'Stuart Russell & Peter Norvig', '9780134610993', 'Artificial Intelligence', 5, 'A-02'],
  ['Deep Learning', 'Ian Goodfellow', '9780262035613', 'Artificial Intelligence', 4, 'A-03'],
  ['Pattern Recognition and Machine Learning', 'Christopher M. Bishop', '9780387310732', 'Machine Learning', 3, 'A-04'],
  ['Hands-On Machine Learning', 'Aurélien Géron', '9781098125974', 'Machine Learning', 5, 'A-05'],
  ['Natural Language Processing with Transformers', 'Lewis Tunstall', '9781098136796', 'Natural Language Processing', 4, 'A-06'],
  ['Computer Networks', 'Andrew S. Tanenbaum', '9780132126953', 'Computer Networks', 4, 'B-01'],
  ['Database System Concepts', 'Abraham Silberschatz', '9780078022159', 'Database Systems', 5, 'B-02'],
  ['Operating System Concepts', 'Abraham Silberschatz', '9781119800361', 'Operating Systems', 5, 'B-03'],
  ['Software Engineering', 'Ian Sommerville', '9780137035151', 'Software Engineering', 5, 'B-04'],
  ['Clean Code', 'Robert C. Martin', '9780132350884', 'Software Engineering', 3, 'B-05'],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann', '9781449373320', 'Data Engineering', 3, 'C-01'],
  ['The Pragmatic Programmer', 'David Thomas & Andrew Hunt', '9780135957059', 'Software Engineering', 3, 'C-02'],
  ['Graph Representation Learning', 'William L. Hamilton', '9781681739632', 'Graph Machine Learning', 2, 'C-03'],
  ['Cloud Computing: Concepts, Technology & Architecture', 'Thomas Erl', '9780133387520', 'Cloud Computing', 3, 'C-04'],
];

async function upsertUser({ name, email, password, role, memberType, membershipId, membershipPlan }) {
  return User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: { name, role, memberType, membershipId, membershipPlan, isActive: true },
      $setOnInsert: { passwordHash: await bcrypt.hash(password, 12) },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function seedDatabase(options = { exit: true }) {
  await connectDatabase();

  const savedPlans = {};
  for (const plan of plans) {
    savedPlans[plan.memberType] = await MembershipPlan.findOneAndUpdate(
      { key: plan.key },
      { $set: plan },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const admin = await upsertUser({
    name: process.env.ADMIN_NAME || 'Library Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@library.local',
    password: adminPassword,
    role: 'admin',
  });

  await LibrarySetting.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        libraryName: 'University Digital Library',
        currency: process.env.FINE_CURRENCY || 'INR',
        timeZone: process.env.LIBRARY_TIMEZONE || 'Asia/Kolkata',
        holdReadyDays: 2,
        allowMemberSelfBorrow: true,
        allowMemberSelfReturn: true,
        updatedBy: admin._id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  if (String(process.env.SEED_DEMO_DATA).toLowerCase() === 'true') {
    await upsertUser({ name: 'Demo Librarian', email: 'librarian@library.local', password: 'Library123!', role: 'librarian' });
    await upsertUser({
      name: 'Demo Student', email: 'student@library.local', password: 'Student123!', role: 'member',
      memberType: 'student', membershipId: 'STU-DEMO-001', membershipPlan: savedPlans.student._id,
    });
    await upsertUser({
      name: 'Demo Faculty', email: 'faculty@library.local', password: 'Faculty123!', role: 'member',
      memberType: 'faculty', membershipId: 'FAC-DEMO-001', membershipPlan: savedPlans.faculty._id,
    });

    for (const [title, author, isbn, category, totalCopies, shelfLocation] of sampleBooks) {
      await Book.findOneAndUpdate(
        { isbn },
        {
          $setOnInsert: {
            title, author, isbn, category, totalCopies, availableCopies: totalCopies,
            shelfLocation, createdBy: admin._id,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
  }

  console.log('Seed complete.');
  console.log(`Admin login: ${process.env.ADMIN_EMAIL || 'admin@library.local'}`);
  if (String(process.env.SEED_DEMO_DATA).toLowerCase() === 'true') {
    console.log('Demo logins: librarian@library.local / Library123! and student@library.local / Student123!');
  }
  if (options.exit) {
    process.exit(0);
  }
}

if (require.main === module) {
  seedDatabase({ exit: true }).catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

module.exports = { seedDatabase };

