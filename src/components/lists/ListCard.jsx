import React from 'react';
import { Link } from 'react-router-dom';

const ListCard = ({ list }) => {
  return (
    <Link 
      to={`/library/lists/${list.id}`}
      className="block bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-200"
    >
      <h3 className="text-xl font-medium mb-2">{list.name}</h3>
      <p className="text-gray-600">Custom List</p>
      <p className="text-sm text-gray-500 mt-2">
        Created: {list.createdAt ? new Date(list.createdAt?.seconds * 1000 || list.createdAt).toLocaleDateString() : 'N/A'}
      </p>
    </Link>
  );
};

export default ListCard;