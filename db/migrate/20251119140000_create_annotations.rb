class CreateAnnotations < ActiveRecord::Migration[8.1]
  def change
    create_table :annotations do |t|
      t.references :scenario, null: false, foreign_key: true
      t.integer :frame_index, null: false
      t.float :time_sec, null: false
      t.string :stream
      t.string :label, null: false
      t.integer :x, null: false
      t.integer :y, null: false
      t.integer :width, null: false
      t.integer :height, null: false

      t.timestamps
    end

    add_index :annotations, [:scenario_id, :frame_index]
  end
end
