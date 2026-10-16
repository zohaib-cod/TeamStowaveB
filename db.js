require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_FILE = path.join(__dirname, 'database.json');

// Initial seed data with rich enterprise records
const initialData = {
  users: [
    {
      id: 'usr_admin_1',
      name: 'Admin Executive (Director)',
      email: 'admin@company.com',
      password: 'password123',
      role: 'admin',
      department: 'Executive Leadership',
      title: 'Chief Operating Officer & Admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      phone: '+1 (555) 019-2834',
      joinDate: '2023-01-15',
      status: 'online',
      points: 2500,
      bio: 'Overseeing global operations, strategic roadmaps, team leadership, and product excellence.',
      skills: ['Strategic Management', 'Team Leadership', 'Operations', 'Resource Planning']
    },
    {
      id: 'usr_member_1',
      name: 'Zohaib Khan',
      email: 'zohaib@company.com',
      password: 'password123',
      role: 'member',
      department: 'Engineering',
      title: 'Senior Full-Stack Architect',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      phone: '+1 (555) 014-9982',
      joinDate: '2023-04-10',
      status: 'online',
      points: 1850,
      bio: 'Leading backend microservices, real-time architectures, and system resilience.',
      skills: ['Next.js', 'Node.js', 'PostgreSQL', 'System Architecture', 'AI Integration']
    },
    {
      id: 'usr_member_2',
      name: 'Ayesha Malik',
      email: 'ayesha@company.com',
      password: 'password123',
      role: 'member',
      department: 'Design & UX',
      title: 'Lead Product Designer',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      phone: '+1 (555) 018-7711',
      joinDate: '2023-06-01',
      status: 'busy',
      points: 1620,
      bio: 'Crafting pixel-perfect user journeys, interactive design systems, and delightful UX.',
      skills: ['Figma', 'UI Systems', 'User Research', 'Motion Design', 'Design Tokens']
    },
    {
      id: 'usr_member_3',
      name: 'Hamza Farooq',
      email: 'hamza@company.com',
      password: 'password123',
      role: 'member',
      department: 'Growth & Marketing',
      title: 'Growth Marketing Strategist',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      phone: '+1 (555) 012-3344',
      joinDate: '2023-08-20',
      status: 'remote',
      points: 1390,
      bio: 'Scaling inbound pipeline, performance campaigns, data analytics, and brand resonance.',
      skills: ['Growth Marketing', 'SEO', 'Data Analytics', 'Conversion Rate Optimization']
    },
    {
      id: 'usr_member_4',
      name: 'Fatima Noor',
      email: 'fatima@company.com',
      password: 'password123',
      role: 'member',
      department: 'Quality Assurance',
      title: 'Senior QA Automation Engineer',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
      phone: '+1 (555) 016-5522',
      joinDate: '2023-11-05',
      status: 'online',
      points: 1200,
      bio: 'Ensuring zero-defect releases with automated e2e pipelines, security, and load testing.',
      skills: ['Cypress', 'Playwright', 'Jest', 'API Automation', 'Security Auditing']
    }
  ],

  tasks: [
    {
      id: 'tsk_101',
      title: 'Deploy High-Concurrency AI Vision Pipeline',
      description: 'Implement real-time image analysis pipeline integrating Groq Llama 3.2 Vision with webcam snapshot streaming.',
      assignedTo: 'usr_member_1',
      assignedBy: 'usr_admin_1',
      priority: 'urgent',
      status: 'in_progress',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      estimatedHours: 16,
      actualHours: 8,
      tags: ['AI', 'Vision', 'Real-time', 'Groq'],
      submissionNotes: 'Camera capture logic hooked up. Working on latency reduction under 500ms.',
      submissionLink: 'https://github.com/company/ai-vision-pipeline',
      reviewedBy: null,
      reviewFeedback: null,
      rating: null
    },
    {
      id: 'tsk_102',
      title: 'Executive Glassmorphic Design System Refactor',
      description: 'Modernize primary navigation and data cards with fluid dark glass aesthetics, tokenized colors, and responsive drawer.',
      assignedTo: 'usr_member_2',
      assignedBy: 'usr_admin_1',
      priority: 'high',
      status: 'review',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      estimatedHours: 12,
      actualHours: 11,
      tags: ['UI/UX', 'Design Tokens', 'Glassmorphism'],
      submissionNotes: 'All components tokenized in pure CSS. Tested across desktop, iPad, and mobile viewpoints.',
      submissionLink: 'https://figma.com/@company/executive-system',
      reviewedBy: 'usr_admin_1',
      reviewFeedback: 'Incredible work on the glow effects and contrast! Approved.',
      rating: 5
    },
    {
      id: 'tsk_103',
      title: 'Q4 B2B Inbound Acquisition Campaign Launch',
      description: 'Set up multi-channel enterprise outreach sequence, landing page A/B tests, and track conversion funnel metrics.',
      assignedTo: 'usr_member_3',
      assignedBy: 'usr_admin_1',
      priority: 'medium',
      status: 'in_progress',
      dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      estimatedHours: 20,
      actualHours: 6,
      tags: ['Growth', 'Marketing', 'Funnel', 'B2B'],
      submissionNotes: '',
      submissionLink: '',
      reviewedBy: null,
      reviewFeedback: null,
      rating: null
    },
    {
      id: 'tsk_104',
      title: 'Automated E2E Regression Suite for Role Portals',
      description: 'Write end-to-end test cases verifying role-based authorization for Admin, Manager, and Team Member routes.',
      assignedTo: 'usr_member_4',
      assignedBy: 'usr_admin_1',
      priority: 'high',
      status: 'completed',
      dueDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      estimatedHours: 14,
      actualHours: 13,
      tags: ['QA', 'Automation', 'Auth', 'Security'],
      submissionNotes: '100% of critical paths passed across 47 integration tests.',
      submissionLink: 'https://ci.company.com/builds/4482',
      reviewedBy: 'usr_admin_1',
      reviewFeedback: 'Flawless execution, zero regressions reported.',
      rating: 5
    }
  ],

  reports: [
    {
      id: 'rep_201',
      userId: 'usr_member_1',
      type: 'daily',
      date: new Date().toISOString().split('T')[0],
      achievements: 'Configured Groq Vision streaming endpoints, optimized audio Speech-to-Text hooks, tested model latencies.',
      plannedNext: 'Add real-time trend scraping with live internet validation and cache layer.',
      blockers: 'None currently. Everything moving ahead smoothly.',
      hoursWorked: 8.5,
      rating: 5,
      adminFeedback: 'Tremendous momentum, keep this up Zohaib!',
      status: 'reviewed'
    },
    {
      id: 'rep_202',
      userId: 'usr_member_2',
      type: 'daily',
      date: new Date().toISOString().split('T')[0],
      achievements: 'Completed peer review modal UI, added smooth micro-interactions, finalized gifting animations.',
      plannedNext: 'Integrate dynamic countdown timers for feedback forms.',
      blockers: 'Awaiting copy confirmation for the new survey guidelines.',
      hoursWorked: 7.5,
      rating: 4.8,
      adminFeedback: 'Brilliant attention to visual aesthetics.',
      status: 'reviewed'
    },
    {
      id: 'rep_203',
      userId: 'usr_member_3',
      type: 'daily',
      date: new Date().toISOString().split('T')[0],
      achievements: 'Audited keyword search volumes for competitor intelligence, drafted 3 whitepapers.',
      plannedNext: 'Finalize email sequence drip campaign.',
      blockers: 'Need Apify scrapers access to pull automated competitor updates.',
      hoursWorked: 8.0,
      rating: null,
      adminFeedback: null,
      status: 'pending'
    }
  ],

  surveys: [
    {
      id: 'srv_301',
      title: 'Admin Behaviour, Leadership & Work Culture Review (Q4)',
      description: 'Your open, transparent feedback helps leadership support you better. How accessible, fair, and empowering is management?',
      targetType: 'admin_behaviour',
      durationHours: 72,
      expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      isAnonymous: true,
      questions: [
        { id: 'q1', text: 'How supportive and approachable is the Admin / Leadership team?', type: 'rating' },
        { id: 'q2', text: 'Do you feel your ideas and strategic suggestions are heard and valued?', type: 'rating' },
        { id: 'q3', text: 'Does leadership provide clear project goals and constructive feedback?', type: 'rating' },
        { id: 'q4', text: 'What is one thing the Admin / Leadership should start, stop, or improve immediately?', type: 'text' }
      ],
      createdBy: 'usr_admin_1',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: 'active'
    },
    {
      id: 'srv_302',
      title: 'Team Collaboration & Remote Tooling Satisfaction Pulse',
      description: 'Evaluate our current tech stack, task delegation speed, and communication cadence.',
      targetType: 'team_culture',
      durationHours: 48,
      expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      isAnonymous: false,
      questions: [
        { id: 'q1', text: 'How satisfied are you with our current task tracking and review workflow?', type: 'rating' },
        { id: 'q2', text: 'How would you rate cross-department communication?', type: 'rating' },
        { id: 'q3', text: 'Any tools or resources you need to deliver 2x faster?', type: 'text' }
      ],
      createdBy: 'usr_admin_1',
      createdAt: new Date().toISOString(),
      status: 'active'
    }
  ],

  survey_responses: [
    {
      id: 'srvr_401',
      surveyId: 'srv_301',
      respondentId: 'anonymous',
      answers: [
        { questionId: 'q1', answer: 5 },
        { questionId: 'q2', answer: 4.8 },
        { questionId: 'q3', answer: 5 },
        { questionId: 'q4', answer: 'The admin is extremely supportive and always accessible for guidance. Encourages continuous innovation!' }
      ],
      submittedAt: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ],

  peer_ratings: [
    {
      id: 'pr_501',
      fromUserId: 'usr_member_1',
      toUserId: 'usr_member_2',
      criteria: {
        collaboration: 5,
        skill: 5,
        communication: 5,
        reliability: 5
      },
      overallScore: 5.0,
      comment: 'Ayesha is an exceptional product designer. Her UI systems cut our development turnaround by 40%!',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'pr_502',
      fromUserId: 'usr_member_2',
      toUserId: 'usr_member_1',
      criteria: {
        collaboration: 5,
        skill: 5,
        communication: 4.8,
        reliability: 5
      },
      overallScore: 4.95,
      comment: 'Zohaib builds APIs with zero friction and lightning speed. A true powerhouse architect.',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'pr_503',
      fromUserId: 'usr_member_3',
      toUserId: 'usr_member_4',
      criteria: {
        collaboration: 4.8,
        skill: 5,
        communication: 5,
        reliability: 5
      },
      overallScore: 4.95,
      comment: 'Fatima caught critical edge cases before our major customer release. Incredible precision!',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ],

  shoutouts: [
    {
      id: 'sho_601',
      fromUserId: 'usr_admin_1',
      toUserId: 'usr_member_1',
      message: 'Huge shout-out to Zohaib for integrating the multi-modal AI Vision pipeline in record time! 🚀',
      category: 'rockstar',
      reactions: { claps: 12, hearts: 8, fire: 15 },
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
    },
    {
      id: 'sho_602',
      fromUserId: 'usr_member_1',
      toUserId: 'usr_member_2',
      message: 'Kudos to Ayesha for the breathtaking dark glass UI designs! Our whole team loves them. ✨',
      category: 'innovation',
      reactions: { claps: 9, hearts: 14, fire: 7 },
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: 'sho_603',
      fromUserId: 'usr_admin_1',
      toUserId: 'usr_member_4',
      message: 'Flawless QA deployment! Zero bug escapes across our high-traffic releases this week. 🛡️',
      category: 'problem_solver',
      reactions: { claps: 15, hearts: 6, fire: 11 },
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ],

  gifts: [
    {
      id: 'gft_701',
      fromUserId: 'usr_admin_1',
      toUserId: 'usr_member_1',
      giftType: 'trophy',
      title: 'Executive MVP Champion Trophy',
      points: 250,
      personalNote: 'Outstanding dedication, architectural brilliance, and leadership during crunch time.',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'gft_702',
      fromUserId: 'usr_member_2',
      toUserId: 'usr_member_4',
      giftType: 'coffee',
      title: 'Artisan Coffee Boost Pack ☕',
      points: 50,
      personalNote: 'Thanks for staying late to test the responsive mobile breakpoints!',
      createdAt: new Date(Date.now() - 3600000 * 14).toISOString()
    }
  ],

  leaves: [
    {
      id: 'lev_801',
      userId: 'usr_member_3',
      type: 'casual',
      startDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
      reason: 'Attending National Tech & Marketing Leadership Summit',
      status: 'approved',
      reviewedBy: 'usr_admin_1',
      reviewedAt: new Date().toISOString()
    }
  ],

  announcements: [
    {
      id: 'ann_901',
      title: '🚀 Q4 Strategic Objectives & Company Roadmap 2026',
      content: 'Welcome team! Our focus this quarter is autonomous AI workflows, customer delight, and peer-driven culture. Let us excel together!',
      priority: 'urgent',
      authorId: 'usr_admin_1',
      pinned: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'ann_902',
      title: '🎉 Monthly Rewards & Gifting Pool Activated',
      content: 'All members have been awarded 500 recognition reward points to gift colleagues and celebrate peer accomplishments.',
      priority: 'important',
      authorId: 'usr_admin_1',
      pinned: false,
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ],

  audit_logs: [
    {
      id: 'log_01',
      userId: 'usr_admin_1',
      action: 'SYSTEM_INIT',
      details: 'Enterprise Team Strategy Hub initialized with AI & Multi-Role portals.',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ],

  settings: {
    companyName: 'Stowave Global Enterprises',
    companyTagline: 'Empowering Teams with Strategic Precision & Omnichannel Social Intelligence',
    apifyApiKey: process.env.APIFY_API_KEY || '',
    groqModel: 'llama-3.3-70b-versatile',
    visionModel: 'llama-3.2-11b-vision-preview'
  }
};

class Database {
  constructor() {
    this.data = this.readFromFile();
    this.mongoClient = null;
    this.mongoDb = null;
    this.isMongoConnected = false;

    if (process.env.MONGODB_URI) {
      this.initPromise = this.initMongo();
    } else {
      this.initPromise = Promise.resolve();
    }
  }

  ensureDb() {
    try {
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      }
    } catch (e) {
      // Ignored on read-only serverless environments
    }
  }

  readFromFile() {
    this.ensureDb();
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (err) {
      console.warn('Notice: File read fallback in db:', err.message);
    }
    return JSON.parse(JSON.stringify(initialData));
  }

  read() {
    return this.data;
  }

  getSettings() {
    return this.data.settings || {};
  }

  write(data) {
    this.data = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      // Serverless (e.g. Vercel) read-only filesystem is expected
    }
    return true;
  }

  async initMongo() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) return;

    try {
      this.mongoClient = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      await this.mongoClient.connect();
      this.mongoDb = this.mongoClient.db('team_stowave');
      this.isMongoConnected = true;
      console.log('🍃 Successfully connected to MongoDB Atlas (team_stowave)!');

      await this.syncFromMongo();
    } catch (err) {
      console.error('⚠️ MongoDB Atlas connection error (falling back to memory/file):', err.message);
    }
  }

  async syncFromMongo() {
    if (!this.mongoDb) return;
    try {
      const collections = [
        'users', 'tasks', 'reports', 'surveys', 'survey_responses',
        'peer_ratings', 'shoutouts', 'gifts', 'leaves', 'announcements',
        'audit_logs', 'social_inbox', 'social_accounts', 'social_posts'
      ];

      const usersCount = await this.mongoDb.collection('users').countDocuments();
      if (usersCount === 0) {
        console.log('🌱 MongoDB is empty. Seeding initial data into MongoDB Atlas...');
        for (const col of collections) {
          const items = this.data[col] || [];
          if (items.length > 0) {
            await this.mongoDb.collection(col).insertMany(items.map(i => ({ ...i })));
          }
        }
        if (this.data.settings) {
          await this.mongoDb.collection('settings').updateOne(
            { key: 'global_settings' },
            { $set: { key: 'global_settings', ...this.data.settings } },
            { upsert: true }
          );
        }
        console.log('✅ Seed data successfully inserted into MongoDB Atlas!');
        return;
      }

      for (const col of collections) {
        const docs = await this.mongoDb.collection(col).find({}).toArray();
        this.data[col] = docs.map(({ _id, ...rest }) => rest);
      }

      const settingsDoc = await this.mongoDb.collection('settings').findOne({ key: 'global_settings' });
      if (settingsDoc) {
        const { _id, key, ...restSettings } = settingsDoc;
        this.data.settings = restSettings;
      }
      console.log(`📦 Loaded ${this.data.users?.length || 0} users & ${this.data.tasks?.length || 0} tasks from MongoDB Atlas!`);
    } catch (err) {
      console.error('Error syncing from MongoDB:', err.message);
    }
  }

  getCollection(name) {
    return this.data[name] || [];
  }

  saveCollection(name, items) {
    this.data[name] = items;
    this.write(this.data);

    if (this.mongoDb) {
      this.mongoDb.collection(name).deleteMany({})
        .then(() => items.length ? this.mongoDb.collection(name).insertMany(items.map(i => ({ ...i }))) : null)
        .catch(err => console.error(`MongoDB saveCollection error on ${name}:`, err.message));
    }
    return items;
  }

  addItem(name, item) {
    if (!this.data[name]) this.data[name] = [];
    if (!item.id) {
      item.id = `${name.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    this.data[name].unshift(item);
    this.write(this.data);

    if (this.mongoDb) {
      this.mongoDb.collection(name).insertOne({ ...item })
        .catch(err => console.error(`MongoDB insert error on ${name}:`, err.message));
    }

    // Also add to audit log
    if (name !== 'audit_logs') {
      this.addItem('audit_logs', {
        id: `log_${Date.now()}`,
        userId: item.userId || item.assignedBy || item.fromUserId || 'system',
        action: `CREATE_${name.toUpperCase()}`,
        details: `Created new item in ${name}: ${item.title || item.name || item.id}`,
        timestamp: new Date().toISOString()
      });
    }

    return item;
  }

  updateItem(name, id, updates) {
    if (!this.data[name]) return null;
    const index = this.data[name].findIndex(item => item.id === id);
    if (index === -1) return null;

    this.data[name][index] = { ...this.data[name][index], ...updates, updatedAt: new Date().toISOString() };
    this.write(this.data);

    if (this.mongoDb) {
      this.mongoDb.collection(name).updateOne({ id }, { $set: updates })
        .catch(err => console.error(`MongoDB update error on ${name}:`, err.message));
    }

    return this.data[name][index];
  }

  deleteItem(name, id) {
    if (!this.data[name]) return false;
    const initialLen = this.data[name].length;
    this.data[name] = this.data[name].filter(item => item.id !== id);
    this.write(this.data);

    if (this.mongoDb) {
      this.mongoDb.collection(name).deleteOne({ id })
        .catch(err => console.error(`MongoDB delete error on ${name}:`, err.message));
    }

    return this.data[name].length < initialLen;
  }

  clearCollection(name) {
    this.data[name] = [];
    this.write(this.data);

    if (this.mongoDb) {
      this.mongoDb.collection(name).deleteMany({})
        .catch(err => console.error(`MongoDB clear error on ${name}:`, err.message));
    }
    return [];
  }

  resetToCleanSlate(adminUser) {
    const freshData = {
      users: adminUser ? [adminUser] : [
        {
          id: 'usr_admin_1',
          name: 'Admin (Stowave Director)',
          email: 'alizohaib.web@gmail.com',
          password: 'password123',
          role: 'admin',
          department: 'Executive Leadership',
          title: 'Chief Operating Officer & Admin',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          phone: '+92 329 0010909',
          joinDate: new Date().toISOString().split('T')[0],
          status: 'online',
          points: 1500,
          bio: 'Strategic administrator overseeing real-time Stowave team operations.',
          skills: ['Strategy', 'Leadership', 'Operations', 'E-Commerce']
        }
      ],
      tasks: [],
      reports: [],
      surveys: [],
      survey_responses: [],
      peer_ratings: [],
      shoutouts: [],
      gifts: [],
      leaves: [],
      announcements: [
        {
          id: 'ann_stowave_welcome',
          title: '🚀 Stowave Workspace Initialized (100% Real-Time)',
          content: 'Welcome to your real-time Stowave company portal. All dummy data has been removed. Use "+ Assign Task" or "+ Add Team Member" to begin.',
          priority: 'urgent',
          pinned: true,
          authorId: 'usr_admin_1',
          createdAt: new Date().toISOString()
        }
      ],
      audit_logs: [
        {
          id: `log_${Date.now()}`,
          userId: 'usr_admin_1',
          action: 'WORKSPACE_RESET',
          details: 'Workspace reset to clean real-time Stowave slate.',
          timestamp: new Date().toISOString()
        }
      ],
      settings: {
        companyName: 'Stowave',
        companyTagline: 'Modern Team Strategy, E-Commerce Operations & Automation',
        timezone: 'UTC+5 (PKT)',
        apifyUserId: process.env.APIFY_USER_ID || '',
        apifyApiKey: process.env.APIFY_API_KEY || '',
        groqModel: 'openai/gpt-oss-120b',
        visionModel: 'qwen/qwen3.8-27b'
      }
    };

    this.data = freshData;
    this.write(freshData);

    if (this.mongoDb) {
      const collections = [
        'users', 'tasks', 'reports', 'surveys', 'survey_responses',
        'peer_ratings', 'shoutouts', 'gifts', 'leaves', 'announcements',
        'audit_logs', 'social_inbox', 'social_accounts', 'social_posts'
      ];
      Promise.all(
        collections.map(col =>
          this.mongoDb.collection(col).deleteMany({})
            .then(() => freshData[col] && freshData[col].length ? this.mongoDb.collection(col).insertMany(freshData[col].map(i => ({ ...i }))) : null)
        )
      ).catch(err => console.error('MongoDB reset error:', err));

      if (freshData.settings) {
        this.mongoDb.collection('settings').updateOne(
          { key: 'global_settings' },
          { $set: { key: 'global_settings', ...freshData.settings } },
          { upsert: true }
        ).catch(err => console.error('MongoDB reset settings error:', err));
      }
    }

    return freshData;
  }
}

module.exports = new Database();
