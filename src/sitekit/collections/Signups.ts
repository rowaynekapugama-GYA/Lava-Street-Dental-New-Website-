import type { CollectionConfig } from 'payload'
import { adminOrEditor } from '../access'

/**
 * Waitlist sign-ups and website enquiries. Each one is kept here as well as emailed (SMTP2GO), so a
 * sign-up is never lost to a mail outage or a spam filter. Created only by the form routes on the server.
 */
export const Signups: CollectionConfig = {
  slug: 'signups',
  labels: { singular: 'Sign-up', plural: 'Waitlist' },
  admin: {
    group: 'Website',
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'phone', 'status', 'createdAt'],
    description: 'Founding patients waitlist sign-ups and contact page enquiries.',
  },
  access: { read: adminOrEditor, create: () => false, update: adminOrEditor, delete: adminOrEditor },
  fields: [
    {
      name: 'form', type: 'select', required: true, defaultValue: 'waitlist', index: true,
      options: [{ label: 'Waitlist', value: 'waitlist' }, { label: 'Enquiry', value: 'enquiry' }],
    },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'text' },
    { name: 'message', type: 'textarea' },
    { name: 'page', type: 'text', label: 'Signed up on' },
    { name: 'consent', type: 'checkbox', defaultValue: false },
    {
      name: 'status', type: 'select', required: true, defaultValue: 'todo', index: true,
      options: [{ label: 'To do', value: 'todo' }, { label: 'Contacted', value: 'contacted' }, { label: 'Booked', value: 'booked' }],
    },
    { name: 'notes', type: 'textarea' },
    {
      name: 'emailStatus', type: 'select', defaultValue: 'sent',
      options: [{ label: 'Sent', value: 'sent' }, { label: 'Not sent', value: 'failed' }],
    },
  ],
}
