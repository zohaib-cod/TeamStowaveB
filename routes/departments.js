const express = require('express');
const db = require('../db');
const { notifyTaskAssigned } = require('../services/emailService');

const router = express.Router();

// Department workflows and operational templates derived directly from Stowave notebook specifications
const DEPARTMENT_DEFINITIONS = [
  {
    id: 'social_media',
    name: 'Social Media Operations',
    icon: 'Share2',
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.1)',
    lead: 'Media Team',
    description: 'Post design, omnichannel broadcasts, comment/DM replies, live monitoring & weekly audits.',
    workflows: [
      {
        id: 'wf_social_daily',
        title: 'Daily Social Media Execution',
        priority: 'high',
        checklist: [
          'Design and schedule daily visual posts across accounts',
          'Fast turnaround replies to customer comments and DMs',
          'Real-time engagement monitoring & brand sentiment check',
          'Weekly audit & strategy document update'
        ]
      }
    ]
  },
  {
    id: 'website_ops',
    name: 'Website & Digital Infrastructure',
    icon: 'Globe',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.1)',
    lead: 'Engineering Team',
    description: 'Continuous maintenance, product catalog updates, uptime monitoring, and SEO posting.',
    workflows: [
      {
        id: 'wf_website_cycle',
        title: 'Website Health, Posting & Performance',
        priority: 'high',
        checklist: [
          'Perform system maintenance & uptime checks',
          'Publish new catalog items, banners & blog posts',
          'Monitor website traffic analytics, errors & conversion funnels'
        ]
      }
    ]
  },
  {
    id: 'email_whatsapp',
    name: 'Email & WhatsApp Marketing',
    icon: 'MessageSquare',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.1)',
    lead: 'Growth Team',
    description: 'Customer history tracking, marketing broadcasts, query resolution, and outbound reach.',
    workflows: [
      {
        id: 'wf_marketing_blast',
        title: 'Omnichannel Marketing Campaign & Outreach',
        priority: 'medium',
        checklist: [
          'Update customer history tracker & segmentation',
          'Dispatch personalized WhatsApp & Email marketing alerts',
          'Address customer inquiries promptly on WhatsApp',
          'Proactive outbound reach to prospective new buyers'
        ]
      }
    ]
  },
  {
    id: 'helpline_support',
    name: 'Helpline & Order Verification',
    icon: 'PhoneCall',
    color: '#d97706',
    bg: 'rgba(245, 158, 11, 0.1)',
    lead: 'Support Team (support@stowave.com)',
    description: 'Order verification calls/WhatsApp, customer dispute resolution, feedback surveys.',
    workflows: [
      {
        id: 'wf_helpline_cycle',
        title: 'Customer Order Verification & Feedback Loop',
        priority: 'urgent',
        checklist: [
          'Call & WhatsApp verification for pending customer orders',
          'Collect post-purchase customer feedback',
          'Broadcast transactional alerts and updates',
          'Re-engage previous customers with special incentives'
        ]
      }
    ]
  },
  {
    id: 'bank_finance',
    name: 'Bank & Cash Accounts Management',
    icon: 'CreditCard',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.1)',
    lead: 'Saif Waqar Hassan (admin@stowave.com)',
    description: 'JazzCash, SadaPay & Bank Me transactions, Cash In/Out logs, 2-person authorization.',
    workflows: [
      {
        id: 'wf_finance_audit',
        title: 'Cash In/Out Reconciliation & Dual Authorization',
        priority: 'urgent',
        checklist: [
          'Verify JazzCash, SadaPay, and Bank Me account balances',
          'Record Cash In and Cash Out details with ledger proof',
          '2-person physical/digital authorization sign-off',
          'Submit urgent transaction applications (call verification if urgent)',
          'Executive approval by Saif Waqar Hassan (admin@stowave.com)'
        ]
      }
    ]
  },
  {
    id: 'customer_history',
    name: 'Customer History Tracking',
    icon: 'History',
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.1)',
    lead: 'Retention Lead',
    description: 'Continuous logging of purchase history and lifecycle points so we can reach them out.',
    workflows: [
      {
        id: 'wf_history_log',
        title: 'Customer Lifecycle & Profile Enrichment',
        priority: 'medium',
        checklist: [
          'Log order history and preferences in master record',
          'Identify dormant accounts needing re-engagement',
          'Prepare weekly customer retention summary'
        ]
      }
    ]
  },
  {
    id: 'audit_checker',
    name: 'Audit & Quality Inspection',
    icon: 'CheckSquare',
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.1)',
    lead: 'Lead Auditor',
    description: 'Find operational problems, compile comprehensive documents, submission to Checker.',
    workflows: [
      {
        id: 'wf_audit_review',
        title: 'Systematic Audit & Problem Resolution',
        priority: 'high',
        checklist: [
          'Identify operational bottlenecks or irregularities',
          'Generate formal problem documentation with evidence',
          'Submit audit dossier to designated Checker for sign-off'
        ]
      }
    ]
  },
  {
    id: 'meetings_presentation',
    name: 'Executive Meetings & Presentations',
    icon: 'Presentation',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    lead: 'Strategic Planning',
    description: 'Arrange team meetings, generate pitch decks, reach out to influencers and brand partners.',
    workflows: [
      {
        id: 'wf_meeting_deck',
        title: 'Strategic Meeting & Partner Outreach Deck',
        priority: 'medium',
        checklist: [
          'Schedule strategic meeting agenda with leadership',
          'Design high-impact slide presentation deck',
          'Outreach to target influencers and partner brands'
        ]
      }
    ]
  },
  {
    id: 'records_maintenance',
    name: 'Records Maintenance (Physical & Soft)',
    icon: 'FileText',
    color: '#475569',
    bg: 'rgba(71, 85, 105, 0.1)',
    lead: 'Ali Haider',
    description: 'Maintain all company records in physical hard copies and soft cloud formats with proper titles.',
    workflows: [
      {
        id: 'wf_records_archive',
        title: 'Ali Haider — Dual Format Record Synchronization',
        priority: 'high',
        checklist: [
          'Archive physical hard-copy invoices, contracts and memos',
          'Scan and digitize soft copies with standard naming convention',
          'Create master index document with proper title and dates',
          'Generate comprehensive whole-data archive of Stowave'
        ]
      }
    ]
  },
  {
    id: 'design_strategy',
    name: 'Design & Strategic Posting',
    icon: 'Palette',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.1)',
    lead: 'Creative Direction',
    description: 'Design posts for all accounts, preserve raw backups, publish with defined strategy documents.',
    workflows: [
      {
        id: 'wf_creative_strategy',
        title: 'Design Posts & Strategy Documentation',
        priority: 'medium',
        checklist: [
          'Design high-resolution creatives for all social channels',
          'Ensure cloud and drive backup for all raw project files',
          'Draft posting strategy document and target audience hook',
          'Document every single micro-step from start to current'
        ]
      }
    ]
  },
  {
    id: 'physical_appearance',
    name: 'Physical & Digital Brand Identity',
    icon: 'Eye',
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.1)',
    lead: 'Brand Inspection (2 Persons)',
    description: 'Cross-check physical office/store appearance and digital assets to ensure identical brand identity.',
    workflows: [
      {
        id: 'wf_brand_inspection',
        title: 'Dual-Person Physical & Digital Alignment',
        priority: 'medium',
        checklist: [
          'Inspect physical store / office visual appearance (2-person check)',
          'Verify website and social channels show matching logos & banners',
          'Log brand identity alignment report'
        ]
      }
    ]
  },
  {
    id: 'executive_approvals',
    name: 'Executive Approvals & Checking [MUST]',
    icon: 'ShieldAlert',
    color: '#be123c',
    bg: 'rgba(190, 18, 60, 0.1)',
    lead: 'Saif Waqar Hassan (admin@stowave.com)',
    description: 'Transaction approvals, mandatory document checking [MUST], and executive authorization.',
    workflows: [
      {
        id: 'wf_exec_approval',
        title: 'Mandatory Document Verification & Application Approval',
        priority: 'urgent',
        checklist: [
          'Verify transaction in/out application accuracy',
          'Checking document verification [MUST requirement]',
          'Official administrative authorization & digital signature'
        ]
      }
    ]
  }
];

/**
 * 1. Get all Department Categories & Preloaded Workflows
 */
router.get('/categories', (req, res) => {
  res.json(DEPARTMENT_DEFINITIONS);
});

/**
 * 2. Get Department Tasks
 */
router.get('/tasks', (req, res) => {
  const { departmentId, status } = req.query;
  let tasks = db.getCollection('tasks');

  // Filter tasks with department tagging
  if (departmentId && departmentId !== 'all') {
    tasks = tasks.filter(t => t.departmentId === departmentId || (t.tags && t.tags.includes(departmentId)));
  }
  if (status && status !== 'all') {
    tasks = tasks.filter(t => t.status === status);
  }

  res.json(tasks);
});

/**
 * 3. Upload / Create a Task under a Department
 */
router.post('/tasks', async (req, res) => {
  const {
    title,
    description,
    departmentId,
    assignedTo,
    assignedBy,
    priority = 'medium',
    dueDate,
    documentUrl,
    estimatedHours = 8,
    checklist = []
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  const dept = DEPARTMENT_DEFINITIONS.find(d => d.id === departmentId);
  const departmentName = dept ? dept.name : (req.body.departmentName || 'General Operations');

  const newTask = {
    id: `tsk_dept_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title,
    description: description || '',
    departmentId: departmentId || 'social_media',
    departmentName,
    assignedTo: assignedTo || 'usr_admin_1',
    assignedBy: assignedBy || 'usr_admin_1',
    priority,
    status: 'todo',
    dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    estimatedHours: Number(estimatedHours) || 8,
    actualHours: 0,
    tags: [departmentName, ...(req.body.tags || [])],
    documentUrl: documentUrl || '',
    checklist: Array.isArray(checklist) ? checklist.map(item => ({
      id: `chk_${Math.random().toString(36).substr(2, 6)}`,
      text: typeof item === 'string' ? item : item.text,
      completed: typeof item === 'object' ? !!item.completed : false
    })) : [],
    submissionNotes: '',
    submissionLink: '',
    reviewedBy: null,
    reviewFeedback: null,
    rating: null
  };

  const saved = db.addItem('tasks', newTask);

  // Email assignee if assigned
  const users = db.getCollection('users');
  const assignee = users.find(u => u.id === newTask.assignedTo);
  if (assignee && assignee.email) {
    notifyTaskAssigned({
      to: assignee.email,
      taskTitle: newTask.title,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      assigneeName: assignee.name
    }).catch(e => console.warn('Department task email warning:', e.message));
  }

  res.status(201).json(saved);
});

/**
 * 4. 1-Click Launch Task from Notebook Template
 */
router.post('/launch-template', async (req, res) => {
  const { departmentId, workflowId, assignedTo, assignedBy, customDueDate } = req.body;
  const dept = DEPARTMENT_DEFINITIONS.find(d => d.id === departmentId);
  if (!dept) {
    return res.status(404).json({ error: 'Department definition not found.' });
  }

  const workflow = dept.workflows.find(w => w.id === workflowId) || dept.workflows[0];
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow template not found.' });
  }

  const newTask = {
    id: `tsk_tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: `[${dept.name}] ${workflow.title}`,
    description: `Notebook Operational Procedure: ${dept.description}`,
    departmentId: dept.id,
    departmentName: dept.name,
    assignedTo: assignedTo || 'usr_admin_1',
    assignedBy: assignedBy || 'usr_admin_1',
    priority: workflow.priority || 'medium',
    status: 'todo',
    dueDate: customDueDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    estimatedHours: 6,
    actualHours: 0,
    tags: [dept.name, 'Notebook Workflow'],
    documentUrl: '',
    checklist: (workflow.checklist || []).map(text => ({
      id: `chk_${Math.random().toString(36).substr(2, 6)}`,
      text,
      completed: false
    })),
    submissionNotes: '',
    submissionLink: '',
    reviewedBy: null,
    reviewFeedback: null,
    rating: null
  };

  const saved = db.addItem('tasks', newTask);

  const users = db.getCollection('users');
  const assignee = users.find(u => u.id === newTask.assignedTo);
  if (assignee && assignee.email) {
    notifyTaskAssigned({
      to: assignee.email,
      taskTitle: newTask.title,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      assigneeName: assignee.name
    }).catch(e => console.warn('Template task email warning:', e.message));
  }

  res.status(201).json(saved);
});

/**
 * 5. Toggle Checklist Item on a Task
 */
router.put('/tasks/:id/checklist', (req, res) => {
  const { checklistIndex, completed } = req.body;
  const tasks = db.getCollection('tasks');
  const task = tasks.find(t => t.id === req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!task.checklist || !task.checklist[checklistIndex]) {
    return res.status(400).json({ error: 'Checklist item not found' });
  }

  task.checklist[checklistIndex].completed = completed;
  const updated = db.updateItem('tasks', task.id, { checklist: task.checklist });
  res.json(updated);
});

module.exports = router;
