import type { ReactNode } from 'react';

// Same avatar/meta/action structure as the approved demo/Panels.tsx roster.
export default function ParticipantRow({avatar,name,description,actions}:{avatar:ReactNode;name:ReactNode;description:ReactNode;actions?:ReactNode}) {
  return <li className="slm-roster-person"><span className="slm-roster-avatar" aria-hidden="true">{avatar}</span><div className="slm-demo-person-meta">{name}{description}</div>{actions}</li>;
}
