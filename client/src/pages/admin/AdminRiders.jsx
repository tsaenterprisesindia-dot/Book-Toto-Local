import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import { timeAgo } from '../../utils/geo.js';

export default function AdminRiders() {
  const [riders, setRiders] = useState([]);

  useEffect(() => {
    client.get('/admin/riders').then(({ data }) => setRiders(data.riders)).catch(() => {});
  }, []);

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>👤 Riders</h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Rating</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {riders.map((r) => (
              <tr key={r._id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.phone || '—'}</td>
                <td>⭐ {r.rating?.toFixed?.(1)}</td>
                <td className="small">{timeAgo(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
