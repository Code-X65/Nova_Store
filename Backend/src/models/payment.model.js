const supabase = require('../config/supabase');

class PaymentModel {
  async create(paymentData) {
    const { data, error } = await supabase
      .from('payments')
      .insert([paymentData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByReference(reference) {
    const { data, error } = await supabase
      .from('payments')
      .select('*, order:orders(*)')
      .eq('reference', reference)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateStatus(id, status, rawResponse = null) {
    const updateData = { status, updated_at: new Date().toISOString() };
    if (rawResponse) updateData.raw_response = rawResponse;

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new PaymentModel();
