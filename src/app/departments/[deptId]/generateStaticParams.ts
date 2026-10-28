// This file enables static export for dynamic route [deptId]
// Slugs must match GET /business/v1/departments
export function generateStaticParams() {
  return [
    { deptId: 'civil' },
    { deptId: 'commercial' },
    { deptId: 'electrical' },
    { deptId: 'legal' },
    { deptId: 'mechanical' },
    { deptId: 'medical' },
    { deptId: 'operating' },
    { deptId: 'personnel' },
    { deptId: 'security' },
    { deptId: 'signal-telecom' },
    { deptId: 'stores' },
  ];
}
