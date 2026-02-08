import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/types/ghana';
import { Building2, Users, Stethoscope, Heart, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleSelectorProps {
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

const roles: { id: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  {
    id: 'policy_maker',
    label: 'Policy Maker',
    description: 'Government officials focused on resource allocation and systemic improvements',
    icon: Building2,
  },
  {
    id: 'ngo',
    label: 'NGO / Aid Organization',
    description: 'Organizations seeking high-impact intervention areas',
    icon: Heart,
  },
  {
    id: 'doctor',
    label: 'Healthcare Professional',
    description: 'Doctors and nurses looking for placement or referral insights',
    icon: Stethoscope,
  },
  {
    id: 'patient',
    label: 'Patient / Public',
    description: 'Finding suitable healthcare facilities',
    icon: Users,
  },
  {
    id: 'general',
    label: 'General Explorer',
    description: 'Comprehensive access to all healthcare data',
    icon: HelpCircle,
  },
];

export function RoleSelector({ selectedRole, onSelectRole }: RoleSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {roles.map((role) => {
        const Icon = role.icon;
        const isSelected = selectedRole === role.id;
        
        return (
          <Card
            key={role.id}
            onClick={() => onSelectRole(role.id)}
            className={cn(
              'cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1',
              isSelected && 'ring-2 ring-primary bg-primary/5'
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'p-2 rounded-lg',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <Badge variant="default" className="text-xs">Selected</Badge>
                )}
              </div>
              <CardTitle className="text-sm font-semibold mt-2">{role.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {role.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
