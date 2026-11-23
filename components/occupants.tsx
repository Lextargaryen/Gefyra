import type { RoomDetail } from '../lib/types'
import { Icon } from './icon'

export function Occupants({ room }: { room: RoomDetail }) {
  return <ul className="occupants">
    {Array.from({ length: room.capacity }, (_, index) => {
      const occupant = room.occupants[index]
      return <li className={occupant ? '' : 'vacant'} key={index}>
        <span className="occupant-icon"><Icon name={occupant ? 'user' : 'door'} size={16}/></span>
        <span>{occupant?.displayName ?? (room.status === 'unavailable' ? 'Unavailable place' : 'Open place')}</span>
        {occupant?.isYou && <small>You</small>}
      </li>
    })}
  </ul>
}
